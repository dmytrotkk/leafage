import { z } from "zod"

import { LeafageError } from "./errors"
import type { eventSchemas } from "./events"
import { rpc } from "./rpc"
import { enums, type Enums, type Fn, type Tables, type Views } from "./schema"
import type { Transport } from "./transport"

interface OpenPest { pest: Enums["pest"]; status: Enums["pest_status"]; rounds: number; last_treated: string | null }
interface Occupant { plant_id: string; name: string }
const GARDEN = [
  "plant_id", "name", "common", "emoji", "individuals", "location", "light_below_need", "last_watered_at", "water_due_on", "water_status",
  "condition", "trend", "pests", "attention", "pot_sealed", "repot_due", "feed_alert", "never_fed", "cover_url", "last_event_at",
] as const
type Garden = Omit<Views["garden"], "pests"> & { pests: OpenPest[] }
export type GardenRow = Pick<Garden, (typeof GARDEN)[number]>
export type PlanRow = Views["plant_feed"]
export type PotRow = Omit<Views["pots_view"], "occupants"> & { occupants: Occupant[] }
export type DueRow = Views["due"]
export type Task = Tables["tasks"]
export type Profile = Tables["profiles"]
type EventType = Enums["event_type"]
type EventData<T extends EventType> = z.infer<(typeof eventSchemas)[T]>
type EventPayload = { [T in EventType]: { type: T; data: EventData<T> } }[EventType]
type EventRow = Tables["events"]
export type TypedEvent = Omit<EventRow, "type" | "data"> & EventPayload
export type PlantDetail = Garden & { plan: PlanRow[]; tasks: Task[]; events: TypedEvent[] }

export interface Catalog {
  taxa: Tables["taxon"][]
  profiles: Tables["care_profile"][]
  substrates: (Tables["substrate"] & { parts: Tables["substrate_part"][] })[]
  supplements: Tables["supplement"][]
  programmes: Tables["programme"][]
  enums: typeof enums
}

const ref = z.string().min(1)
const dose = z.number().gt(0).max(1)
const size = z.number().gt(0)
const interval = z.int().min(1).max(60)
const count = z.int().min(0)
const patch = <T extends z.ZodRawShape>(shape: T) => z.object(shape).partial().strict()

const profilePatch = patch({ display_name: ref, timezone: ref }).refine((p) => Object.keys(p).length > 0, "give display_name, timezone, or both")
export type ProfilePatch = z.input<typeof profilePatch>

export const filterSchema = patch({
  location: z.enum(enums.location_zone),
  pot: ref,
  profile: ref,
  taxon: ref,
  attention: z.boolean(),
  water_status: z.enum(enums.water_status),
  feed_status: z.enum(enums.feed_status),
})
const PHOTO_BUCKET = "plant-photos"
export const PHOTO_TTL_SECONDS = 60 * 60 * 8
const selector = z.union([z.array(ref).min(1), filterSchema])
export type PlantFilter = z.infer<typeof filterSchema>

const pestList = z.array(z.object({ pest: z.enum(enums.pest), status: z.enum(["suspected", "confirmed", "cleared"]) }).strict())
const partList = z.array(z.object({ component: z.enum(enums.substrate_component), percent: z.int().min(1).max(100).optional() }).strict())
const plantPatch = patch({
  name: ref,
  taxon: ref.nullable(),
  origin: z.enum(enums.origin_type).nullable(),
  origin_date: z.iso.date().nullable(),
  origin_date_precision: z.enum(enums.date_precision).nullable(),
  individuals: z.int().min(1),
  water_interval_days: interval.nullable(),
  repot_target_cm: z.int().min(1).nullable(),
  repot_after: z.iso.date().nullable(),
  cover_event_id: z.int().nullable(),
  notes: z.string().nullable(),
})
const potPatch = patch({
  label: ref,
  material: z.enum(enums.pot_material).nullable(),
  diameter_cm: size.nullable(),
  height_cm: size.nullable(),
  saucer: z.boolean(),
  drainage: z.boolean().nullable(),
  notes: z.string().nullable(),
})
const feedPatch = patch({ dose_factor: dose.nullable(), hold_until: z.iso.date().nullable() })

const empty = z.object({}).strict()

export const schemas = {
  ...rpc,
  garden: filterSchema,
  plant: z.object({ plant: z.string(), events: z.int().min(1).max(200).optional() }).strict(),
  due: filterSchema.extend({ days: z.int().min(0).max(90).optional() }),
  tasks: z.object({ status: z.enum(enums.task_status).optional() }).strict(),
  pots: empty,
  catalog: empty,
  photo_urls: z.object({ paths: z.array(ref).min(1).max(500) }).strict(),
  water: rpc.water.extend({ plants: selector.optional(), ml: count.optional() }),
  feed: rpc.feed.extend({ plants: selector.optional(), dose_factor: dose.optional() }),
  treat: rpc.treat.extend({ plants: selector }),
  repot: rpc.repot.extend({ hold_feed_days: count.optional() }),
  diagnose: rpc.diagnose.extend({ pests: pestList.optional() }),
  move: rpc.move.extend({ plants: selector }),
  note: rpc.note.extend({ text: ref, plants: selector.optional() }),
  photo: rpc.photo.extend({ plants: selector.optional() }),
  create_plant: rpc.create_plant.extend({ name: ref, individuals: z.int().min(1).optional(), water_interval_days: interval.optional() }),
  update_plant: rpc.update_plant.extend({ plants: selector, patch: plantPatch }),
  create_pot: rpc.create_pot.extend({ label: ref, diameter_cm: size.optional(), height_cm: size.optional() }),
  update_pot: rpc.update_pot.extend({ patch: potPatch }),
  update_feed: rpc.update_feed.extend({ plants: selector, patch: feedPatch }),
  create_substrate: rpc.create_substrate.extend({ label: ref, parts: partList.optional() }),
  create_supplement: rpc.create_supplement.extend({ label: ref }),
  create_task: rpc.create_task.extend({ title: ref, priority: z.int().min(1).max(3).optional() }),
  complete_task: rpc.complete_task.extend({ tasks: z.union([z.int(), z.array(z.int()).min(1)]), status: z.enum(["done", "skipped"]).optional() }),
}

type Verb = keyof typeof rpc
export type Input<K extends keyof typeof schemas> = z.input<(typeof schemas)[K]>
type Params<K extends Verb> = Record<string, never> extends Input<K> ? [input?: Input<K>] : [input: Input<K>]
type Verbs = { [K in Verb]: (...params: Params<K>) => Promise<Fn[K]["Returns"]> }

function validate<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input)
  if (result.success) return result.data
  const issue = result.error.issues[0]
  const field = issue?.path.filter((p) => typeof p === "string").join(".") || "args"
  const allowed = issue && "values" in issue ? issue.values : undefined
  throw new LeafageError("invalid_value", { field, ...(allowed ? { allowed } : {}) }, issue?.message ?? "invalid arguments")
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function addDays(day: string, days: number): string {
  const d = new Date(`${day}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function createCore(transport: Transport) {
  const verbs = Object.fromEntries(
    Object.keys(rpc).map((name) => [name, async (input: unknown) => transport.rpc(name, validate(schemas[name as Verb] as z.ZodType, input ?? {}))]),
  ) as Verbs
  const list = <T>(relation: string, query: Record<string, string> = {}) => transport.select<T[]>(relation, { select: "*", ...query })

  async function garden(input: Input<"garden"> = {}): Promise<GardenRow[]> {
    const f = validate(schemas.garden, input)
    const q: Record<string, string> = { select: GARDEN.join(","), order: "name" }
    if (f.location) q.location = `eq.${f.location}`
    if (f.pot) q[UUID.test(f.pot) ? "pot_id" : "pot_label"] = `eq.${f.pot}`
    if (f.profile) q.profile_id = `eq.${f.profile}`
    if (f.taxon) q.taxon_id = `eq.${f.taxon}`
    if (f.attention !== undefined) q.attention = `eq.${f.attention}`
    if (f.water_status) q.water_status = `eq.${f.water_status}`
    if (f.feed_status) {
      const rows = await transport.select<{ plant_id: string }[]>("plant_feed", { select: "plant_id", status: `eq.${f.feed_status}` })
      q.plant_id = `in.(${rows.map((r) => r.plant_id).join(",")})`
    }
    return list<GardenRow>("garden", q)
  }

  async function plant(input: Input<"plant">): Promise<PlantDetail> {
    const { plant: plantRef, events = 20 } = validate(schemas.plant, input)
    const [row] = await list<Garden>("garden", { [UUID.test(plantRef) ? "plant_id" : "name"]: `eq.${plantRef}`, limit: "1" })
    if (!row) throw new LeafageError("not_found", { plant: plantRef }, "no active plant with this name or id")
    const [plan, tasks, log] = await Promise.all([
      list<PlanRow>("plant_feed", { plant_id: `eq.${row.plant_id}`, order: "supplement_id" }),
      list<Task>("tasks", { plant_id: `eq.${row.plant_id}`, status: "eq.todo", order: "due_on.nullslast" }),
      list<TypedEvent>("events", { plant_id: `eq.${row.plant_id}`, voided_at: "is.null", order: "ts.desc,id.desc", limit: String(events) }),
    ])
    return { ...row, plan, tasks, events: log }
  }

  async function due(input: Input<"due"> = {}): Promise<{ today: string; rows: DueRow[] }> {
    const { days = 7, ...filter } = validate(schemas.due, input)
    const [today, rows, scope] = await Promise.all([
      verbs.local_date(),
      list<DueRow>("due", { order: "due_on.asc.nullslast,name.asc.nullsfirst" }),
      Object.keys(filter).length ? garden(filter).then((g) => new Set(g.map((r) => r.plant_id))) : null,
    ])
    const limit = addDays(today, days)
    return { today, rows: rows.filter((r) => (scope === null || (r.plant_id !== null && scope.has(r.plant_id))) && (r.due_on === null || r.due_on <= limit)) }
  }

  const pots = () => list<PotRow>("pots_view", { order: "label" })
  const tasks = (input: Input<"tasks"> = {}) => {
    const { status = "todo" } = validate(schemas.tasks, input)
    return list<Task>("tasks", { status: `eq.${status}`, order: status === "todo" ? "due_on.asc.nullslast,priority.asc,id.asc" : "completed_at.desc" })
  }
  const profile = () => transport.select<Profile>("profiles", { select: "*", limit: "1" }, { single: true })
  const update_profile = async (p: ProfilePatch) => {
    const body = validate(profilePatch, p)
    return transport.patch<Profile>("profiles", { id: `eq.${(await profile()).id}` }, body)
  }

  async function catalog(): Promise<Catalog> {
    const [taxa, profiles, substrates, supplements, programmes] = await Promise.all([
      list<Catalog["taxa"][number]>("taxon", { order: "id" }),
      list<Catalog["profiles"][number]>("care_profile", { order: "id" }),
      list<Catalog["substrates"][number]>("substrate", { select: "*,parts:substrate_part(*)", order: "label" }),
      list<Catalog["supplements"][number]>("supplement", { order: "label" }),
      list<Catalog["programmes"][number]>("programme"),
    ])
    return { taxa, profiles, substrates, supplements, programmes, enums }
  }

  const photo_urls = async (input: Input<"photo_urls">) => transport.sign(PHOTO_BUCKET, validate(schemas.photo_urls, input).paths, PHOTO_TTL_SECONDS)

  return { garden, plant, due, tasks, pots, catalog, profile, update_profile, photo_urls, ...verbs }
}

export type Core = ReturnType<typeof createCore>
