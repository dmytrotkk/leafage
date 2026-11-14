import { RESOURCE_MIME_TYPE, registerAppTool } from "@modelcontextprotocol/ext-apps/server"
import { McpServer, ResourceTemplate, type CallToolResult, type ToolAnnotations } from "@modelcontextprotocol/server"
import { LeafageError, schemas, type Core, type GardenRow } from "@leafage/core"
import type { z } from "zod"

type Tool = Exclude<keyof typeof schemas, "event_schema" | "local_date" | "wipe_garden">

export interface Host {
  origin: string
  storage: string
  build: string
  shell: () => Promise<string>
}

const READ: ToolAnnotations = { readOnlyHint: true, destructiveHint: false, openWorldHint: false }
const LOG: ToolAnnotations = { readOnlyHint: false, destructiveHint: false, openWorldHint: false }
const PATCH: ToolAnnotations = { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false }
const DESTROY: ToolAnnotations = { readOnlyHint: false, destructiveHint: true, openWorldHint: false }

const HOUR = 3_600_000
const APP_ONLY = { ui: { visibility: ["app"] } }
const CLAUDE_FONTS = "https://assets.claude.ai"

const INSTRUCTIONS =
  "Leafage is the user's own garden log. Read before writing: garden, plant, due, tasks, pots, catalog. " +
  "`plants` takes names, ids or a filter; omitted, water and feed act on what is due. `at` back-dates an entry. " +
  "Correct a mistake with void_event, never by logging again. Dates are in the owner's timezone. " +
  "Call show_garden only when the user wants to see the garden; use garden when you only need the data."

const FILTER = "Filter fields are ANDed."
const SELECTOR = "`plants` is a list of names or ids, or a filter {location, pot, profile, taxon, attention, water_status, feed_status}."
const AT = "Optional `at` back-dates it."

const TOOLS: Record<Tool, [title: string, description: string, annotations: ToolAnnotations, meta?: typeof APP_ONLY]> = {
  garden: ["Garden data", `Every active plant at a glance: water and feed status, condition and trend, open pests, attention. Use \`plant\` for the full record. ${FILTER}`, READ],
  plant: ["Plant", "Everything about one plant by name or id: its full row (pot, substrate, light, repot plan, notes), feeding plan, open tasks and the last events (default 20).", READ],
  due: ["Due", "What needs doing within `days` (default 7), with the owner's `today`: water, feed, treatment, pot and task rows, overdue first. Filter fields scope the plants.", READ],
  tasks: ["Tasks", "Tasks by status (default todo): open ones by due date, or the done and skipped ones most recent first.", READ],
  pots: ["Pots", "Every pot: material, size, volume, substrate and current occupants.", READ],
  catalog: ["Catalog", "Taxa, care profiles, substrates, supplements, feeding programmes and every enum's allowed values.", READ],
  photo_urls: ["Photo URLs", "Short-lived signed URLs for the caller's own photo paths, for the embedded app to display them.", READ, APP_ONLY],
  water: ["Water", `Log a watering. ${SELECTOR} Omitted, it waters every plant not watered in the last 24 hours. ${AT}`, LOG],
  feed: ["Feed", `Log a feed with a supplement (id or label). ${SELECTOR} Omitted, it feeds every plant whose plan for that supplement is overdue, due or recommended. ${AT}`, LOG],
  treat: ["Treat pests", `Log a pest treatment: opens or advances the case (rounds, last treated). ${SELECTOR} ${AT}`, LOG],
  repot: ["Repot", `Move one plant into a pot (id or label), optionally with a substrate; feeding is held for 28 days by default. ${AT}`, LOG],
  diagnose: ["Diagnose", `Record an assessment of one plant: condition, phase, symptoms, disorders, pests (pests [] clears every open case). At least one field or a note. ${AT}`, LOG],
  measure: ["Measure", `Record height, canopy or trunk measurements for one plant. ${AT}`, LOG],
  prune: ["Prune", `Log a prune of one plant: canopy, roots, deadwood, flowers or suckers. ${AT}`, LOG],
  move: ["Move", `Move plants to a location and/or light level. ${SELECTOR} ${AT}`, LOG],
  note: ["Note", `Add a note to plants, or to the garden when \`plants\` is omitted. ${SELECTOR} ${AT}`, LOG],
  photo: ["Attach photo", `Attach an already uploaded photo (a storage path under your own prefix) to plants, or to the garden. ${SELECTOR} ${AT}`, LOG],
  void_event: ["Void event", "Void a mistaken event by id with a reason; the plant is re-projected from its remaining history.", DESTROY],
  create_plant: ["Create plant", "Create a plant. Only `name` is required; taxon, origin, location, light, condition, height, pot and substrate become its first events.", LOG],
  update_plant: ["Update plant", `Patch plant settings: name, taxon, origin, individuals, water interval, repot plan, cover photo event, notes. ${SELECTOR} Name, taxon, cover and notes need exactly one match.`, PATCH],
  archive_plant: ["Archive plant", "Archive one plant as dead, given_away, lost or mistake. It leaves every view, frees its pot and skips its open tasks.", DESTROY],
  create_pot: ["Create pot", "Create a pot. Only `label` is required.", LOG],
  update_pot: ["Update pot", "Patch a pot: label, material, size, saucer, drainage (drainage can only become true), notes.", PATCH],
  retire_pot: ["Retire pot", "Retire an empty pot.", DESTROY],
  update_feed: ["Adjust feed", `Override a plant's feed for a supplement: dose factor and/or hold until a date; null clears. ${SELECTOR}`, PATCH],
  create_substrate: ["Create substrate", "Create your own substrate recipe with its parts.", LOG],
  create_supplement: ["Create supplement", "Create your own supplement: role, form, nutrients supplied, method.", LOG],
  create_task: ["Create task", "Create a task, optionally for one plant, with kind, due date, priority 1 to 3 and detail.", LOG],
  complete_task: ["Complete task", "Close one or more tasks by id as done or skipped.", PATCH],
}

function summary(rows: GardenRow[]) {
  return {
    plants: rows.length,
    need_water: rows.filter((r) => r.water_status === "overdue" || r.water_status === "due").map((r) => r.name),
    attention: rows.filter((r) => r.attention).map((r) => r.name),
  }
}

async function run(fn: () => Promise<unknown>): Promise<CallToolResult> {
  try {
    const text = JSON.stringify(await fn(), (key, value) => (key === "owner_id" ? undefined : value)) ?? "null"
    return { content: [{ type: "text", text }], structuredContent: { result: JSON.parse(text) } }
  } catch (e) {
    if (e instanceof LeafageError) {
      return {
        content: [{ type: "text", text: `${e.code}: ${e.hint}` }],
        structuredContent: { error: e.code, detail: e.detail, hint: e.hint },
        isError: true,
      }
    }
    return { content: [{ type: "text", text: e instanceof Error ? e.message : String(e) }], isError: true }
  }
}

export function createServer(core: Core, name: string, version: string, host: Host): McpServer {
  const server = new McpServer(
    {
      name,
      version,
      title: "Leafage",
      websiteUrl: "https://leafage.garden",
      icons: [
        { src: `${host.origin}/icon-light.png`, mimeType: "image/png", sizes: ["192x192"], theme: "light" },
        { src: `${host.origin}/icon-dark-512.png`, mimeType: "image/png", sizes: ["512x512"], theme: "dark" },
      ],
    },
    {
      instructions: INSTRUCTIONS,
      capabilities: { tools: { listChanged: false }, resources: { listChanged: false } },
      cacheHints: { "tools/list": { ttlMs: HOUR, cacheScope: "public" }, "server/discover": { ttlMs: HOUR, cacheScope: "public" } },
    },
  )

  const gardenUi = `ui://leafage/garden-${host.build}`
  const garden = { name: "garden", title: "Garden", mimeType: RESOURCE_MIME_TYPE }
  server.registerResource(
    garden.name,
    new ResourceTemplate("ui://leafage/garden-{build}", { list: () => ({ resources: [{ uri: gardenUi, ...garden }] }) }),
    garden,
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: RESOURCE_MIME_TYPE,
          text: await host.shell(),
          _meta: { ui: { csp: { resourceDomains: [host.origin, host.storage, CLAUDE_FONTS] }, prefersBorder: false } },
        },
      ],
    }),
  )
  registerAppTool(
    server,
    "show_garden",
    {
      title: "Garden",
      description: `Show the garden to the user as an interactive view. Returns only the plant count and the names that need water or attention; use \`garden\` when you need the data. ${FILTER}`,
      inputSchema: schemas.garden,
      annotations: READ,
      _meta: { ui: { resourceUri: gardenUi }, "openai/ui": { entrypoints: [{ type: "global" }], availableDisplayModes: ["fullscreen"] } },
    },
    (filter) => run(async () => summary(await core.garden(filter))),
  )

  for (const tool of Object.keys(TOOLS) as Tool[]) {
    const [title, description, annotations, _meta] = TOOLS[tool]
    const call = core[tool] as (input: unknown) => Promise<unknown>
    server.registerTool(tool, { title, description, inputSchema: schemas[tool] as z.ZodObject, annotations, ...(_meta && { _meta }) }, (input) => run(() => call(input)))
  }

  return server
}
