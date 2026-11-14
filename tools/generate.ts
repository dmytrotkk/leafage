import { SQL } from "bun"

interface PgType { typname: string; typtype: string; elem: string | null; elemtype: string | null }
interface Column { relname: string; relkind: string; attname: string; attnotnull: boolean; typid: number; description: string | null }
interface Enum { typname: string; labels: string[] }
interface Fn {
  proname: string; proretset: boolean; pronargdefaults: number; ret_relname: string | null
  rettypid: number; modes: string[]; names: string[]; argtypes: number[]
}
interface JsonSchema {
  type?: string | string[]; enum?: string[]; anyOf?: JsonSchema[]; items?: JsonSchema
  properties?: Record<string, JsonSchema>; required?: string[]; minimum?: number; maximum?: number
}

const TYPE: Record<string, [ts: string, zod: string]> = {
  text: ["string", "z.string()"], varchar: ["string", "z.string()"], bpchar: ["string", "z.string()"],
  name: ["string", "z.string()"], uuid: ["string", "z.string()"], date: ["string", "z.iso.date()"],
  timestamp: ["string", "z.iso.datetime()"], timestamptz: ["string", "z.iso.datetime({ offset: true })"],
  bool: ["boolean", "z.boolean()"], int2: ["number", "z.int()"], int4: ["number", "z.int()"], int8: ["number", "z.int()"],
  numeric: ["number", "z.number()"], float4: ["number", "z.number()"], float8: ["number", "z.number()"],
  json: ["Json", "z.unknown()"], jsonb: ["Json", "z.unknown()"], void: ["void", "z.void()"],
}

const sql = new SQL(process.env.DATABASE_URL!)

const types = new Map<number, PgType>(
  ((await sql`select t.oid::int as oid, t.typname, t.typtype, e.typname as elem, e.typtype as elemtype
              from pg_type t left join pg_type e on e.oid = t.typelem`) as (PgType & { oid: number })[]).map((r) => [r.oid, r]),
)

const enums = (await sql`
  select t.typname, to_jsonb(array_agg(e.enumlabel order by e.enumsortorder)) as labels
  from pg_type t join pg_enum e on e.enumtypid = t.oid
  where t.typnamespace = 'public'::regnamespace group by t.typname order by t.typname`) as Enum[]

const columns = (await sql`
  select c.relname, c.relkind, a.attname, a.attnotnull, a.atttypid::int as typid, d.description
  from pg_class c
  join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
  left join pg_description d on d.objoid = c.oid and d.objsubid = a.attnum
  where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'v')
  order by c.relname, a.attnum`) as Column[]

const functions = (await sql`
  select p.proname, p.proretset, p.pronargdefaults, rc.relname as ret_relname, p.prorettype::int as rettypid,
    to_jsonb(coalesce(p.proargmodes::text[], '{}')) as modes,
    to_jsonb(coalesce(p.proargnames, '{}')) as names,
    to_jsonb(coalesce(p.proallargtypes, p.proargtypes::oid[])::int[]) as argtypes
  from pg_proc p
  join pg_type rt on rt.oid = p.prorettype
  left join pg_class rc on rc.oid = rt.typrelid and rc.relkind = 'r'
  where p.pronamespace = 'public'::regnamespace and has_function_privilege('authenticated', p.oid, 'execute')
  order by p.proname`) as Fn[]

const payloads = (await sql`
  select t::text as type, public.event_schema(t) as schema
  from unnest(enum_range(null::public.event_type)) t order by t`) as { type: string; schema: JsonSchema }[]

await sql.end()

function render(kind: "ts" | "zod", t: PgType): string {
  if (t.typtype === "e") return kind === "ts" ? `Enums["${t.typname}"]` : `z.enum(enums.${t.typname})`
  if (t.typname.startsWith("_") && t.elem) {
    const item = render(kind, { typname: t.elem, typtype: t.elemtype!, elem: null, elemtype: null })
    return kind === "ts" ? `${item}[]` : `z.array(${item})`
  }
  const mapped = TYPE[t.typname]?.[kind === "ts" ? 0 : 1]
  if (!mapped) throw new Error(`no ${kind} mapping for ${t.typname}`)
  return mapped
}

const byOid = (oid: number) => {
  const t = types.get(oid)
  if (!t) throw new Error(`unknown type oid ${oid}`)
  return t
}
const ts = (oid: number) => render("ts", byOid(oid))
const zod = (oid: number) => render("zod", byOid(oid))

const grouped = Object.groupBy(columns, (c) => c.relname)
const column = (c: Column) =>
  `    ${c.attname}: ${ts(c.typid)}${(c.relkind === "r" ? c.attnotnull : c.description === "@notNull") ? "" : " | null"}`
const relations = (relkind: string) =>
  Object.entries(grouped)
    .filter(([, cols]) => cols![0]!.relkind === relkind)
    .map(([name, cols]) => `  ${name}: {\n${cols!.map(column).join("\n")}\n  }`)
    .join("\n")

const inputs = (f: Fn) =>
  f.argtypes
    .flatMap((oid, i) => (f.modes[i] === "t" ? [] : [{ name: f.names[i]!, oid }]))
    .map((a, i, all) => ({ ...a, optional: i >= all.length - f.pronargdefaults }))

const args = (f: Fn) => {
  const all = inputs(f)
  return all.length ? `{ ${all.map((a) => `${a.name}${a.optional ? "?" : ""}: ${ts(a.oid)}`).join("; ")} }` : "Record<string, never>"
}

const returns = (f: Fn) => {
  if (f.ret_relname) return `Tables["${f.ret_relname}"]${f.proretset ? "[]" : ""}`
  const out = f.modes.flatMap((m, i) => (m === "t" ? [`${f.names[i]}: ${ts(f.argtypes[i]!)} | null`] : []))
  return out.length ? `{ ${out.join("; ")} }[]` : `${ts(f.rettypid)}${f.proretset ? "[]" : ""}`
}

const argSchema = (f: Fn) => {
  const body = inputs(f)
    .map((a) => `${a.name}: ${zod(a.oid)}${a.optional ? ".optional()" : ""}`)
    .join(", ")
  return `  ${f.proname}: z.object({${body && ` ${body} `}}).strict(),`
}

const INT = 9007199254740991
const named = new Map(enums.map((e) => [JSON.stringify(e.labels), e.typname]))

function payload(s: JsonSchema): string {
  if (s.anyOf) {
    const [inner, nul] = s.anyOf
    if (s.anyOf.length !== 2 || !inner || nul?.type !== "null") throw new Error(`unsupported anyOf ${JSON.stringify(s)}`)
    return `${payload(inner)}.nullable()`
  }
  if (Array.isArray(s.type)) {
    const [inner, nul] = s.type
    if (s.type.length !== 2 || !inner || nul !== "null") throw new Error(`unsupported type ${JSON.stringify(s)}`)
    return `${payload({ ...s, type: inner })}.nullable()`
  }
  switch (s.type) {
    case "object": {
      const props = s.properties ?? {}
      const required = s.required ?? []
      const keys = [...required, ...Object.keys(props).filter((k) => !required.includes(k))]
      return `z.object({ ${keys.map((k) => `${k}: ${payload(props[k]!)}${required.includes(k) ? "" : ".optional()"}`).join(", ")} }).strict()`
    }
    case "array":
      return `z.array(${payload(s.items!)})`
    case "string":
      if (!s.enum) return "z.string()"
      return named.has(JSON.stringify(s.enum))
        ? `z.enum(enums.${named.get(JSON.stringify(s.enum))})`
        : `z.enum([${s.enum.map((v) => `"${v}"`).join(", ")}])`
    case "integer":
      return `z.int()${s.minimum === -INT ? "" : `.min(${s.minimum})`}${s.maximum === INT ? "" : `.max(${s.maximum})`}`
    case "number":
      return "z.number()"
    case "boolean":
      return "z.boolean()"
    case "null":
      return "z.null()"
  }
  throw new Error(`unsupported schema ${JSON.stringify(s)}`)
}

const files = {
  "core/schema.ts": `export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export const enums = {
${enums.map((e) => `  ${e.typname}: [${e.labels.map((l) => `"${l}"`).join(", ")}],`).join("\n")}
} as const

export type Enums = { [K in keyof typeof enums]: (typeof enums)[K][number] }

export interface Tables {
${relations("r")}
}

export interface Views {
${relations("v")}
}

export interface Fn {
${functions.map((f) => `  ${f.proname}: { Args: ${args(f)}; Returns: ${returns(f)} }`).join("\n")}
}
`,
  "core/rpc.ts": `import { z } from "zod"

import { enums } from "./schema"

export const rpc = {
${functions.map(argSchema).join("\n")}
}
`,
  "core/events.ts": `import { z } from "zod"

import { enums, type Enums } from "./schema"

export const eventJson = {
${payloads.map((p) => `  ${p.type}: ${JSON.stringify(p.schema)},`).join("\n")}
} satisfies Record<Enums["event_type"], unknown>

export const eventSchemas = {
${payloads.map((p) => `  ${p.type}: ${payload(p.schema)},`).join("\n")}
} satisfies Record<Enums["event_type"], z.ZodType>
`,
}

for (const [path, text] of Object.entries(files)) {
  await Bun.write(path, text)
  console.log(`${path}: ${text.split("\n").length - 1} lines`)
}
