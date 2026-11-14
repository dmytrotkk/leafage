import { afterAll, beforeAll, expect, test } from "bun:test"

import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client"
import { createMcpHandler, type AuthInfo } from "@modelcontextprotocol/server"

import { createServer } from "../worker/tools"
import { signIn } from "./session"

const { core } = await signIn()
const authInfo: AuthInfo = { token: "test", clientId: "test", scopes: [] }
const SHELL = '<script type="module" src="https://app.test/assets/embed.js"></script>'
const handler = createMcpHandler(() => createServer(core, "leafage", "test", { origin: "https://app.test", storage: "https://db.test", build: "test", shell: async () => SHELL }))

async function connect(mode: "auto" | "legacy"): Promise<Client> {
  const client = new Client({ name: "test", version: "0" }, { versionNegotiation: { mode } })
  const transport = new StreamableHTTPClientTransport(new URL("https://app.test/mcp"), {
    fetch: (url, init) => handler.fetch(new Request(String(url), init), { authInfo }),
  })
  await client.connect(transport)
  return client
}

const READS = ["catalog", "due", "garden", "photo_urls", "plant", "pots", "show_garden", "tasks"]
const TOOLS = [
  ...READS,
  "water", "feed", "treat", "repot", "diagnose", "measure", "prune", "move", "note", "photo", "void_event",
  "create_plant", "update_plant", "archive_plant", "create_pot", "update_pot", "retire_pot", "update_feed",
  "create_substrate", "create_supplement", "create_task", "complete_task",
]

let client: Client

beforeAll(async () => {
  await core.wipe_garden()
  client = await connect("auto")
})

afterAll(async () => {
  await client.close()
  await core.wipe_garden()
})

const call = (name: string, args: Record<string, unknown> = {}) => client.callTool({ name, arguments: args })
const structured = (result: Awaited<ReturnType<typeof call>>) => result.structuredContent as Record<string, unknown>

test("30 titled tools with explicit hints, reads marked read-only, same list and order for a 2025-era client", async () => {
  const { tools } = await client.listTools()
  expect(tools.map((t) => t.name).sort()).toEqual([...TOOLS].sort())
  expect(tools.filter((t) => !t.title).map((t) => t.name)).toEqual([])
  expect(new Set(tools.map((t) => t.title)).size).toBe(tools.length)
  expect(client.getServerCapabilities()).toMatchObject({ tools: { listChanged: false }, resources: { listChanged: false } })
  const hints = ["readOnlyHint", "destructiveHint", "openWorldHint"] as const
  expect(tools.filter((t) => hints.some((h) => typeof t.annotations?.[h] !== "boolean")).map((t) => t.name)).toEqual([])
  expect(tools.filter((t) => t.annotations?.readOnlyHint).map((t) => t.name).sort()).toEqual(READS)
  const legacy = await connect("legacy")
  expect((await legacy.listTools()).tools.map((t) => t.name)).toEqual(tools.map((t) => t.name))
  await legacy.close()
})

test("a write round trip through the tools", async () => {
  const created = await call("create_pot", { label: "mcp pot", drainage: true })
  expect(created.isError).toBeFalsy()
  expect(structured(created)).toMatchObject({ result: { label: "mcp pot", drainage: true } })
  expect(structured(await call("pots"))).toMatchObject({ result: [{ label: "mcp pot", status: "empty" }] })
  expect(structured(await call("garden", { location: "balcony" }))).toEqual({ result: [] })
  expect(structured(await call("retire_pot", { pot: "mcp pot" }))).toMatchObject({ result: { label: "mcp pot" } })
})

test("show_garden links the app resource, which reads as an MCP App shell", async () => {
  const tool = (await client.listTools()).tools.find((t) => t.name === "show_garden")!
  const uri = (tool._meta?.ui as { resourceUri: string }).resourceUri
  expect(uri).toBe("ui://leafage/garden-test")
  expect(tool._meta?.["openai/ui"]).toEqual({ entrypoints: [{ type: "global" }], availableDisplayModes: ["fullscreen"] })
  const [content] = (await client.readResource({ uri })).contents
  expect(content).toMatchObject({
    uri,
    mimeType: "text/html;profile=mcp-app",
    text: SHELL,
    _meta: { ui: { csp: { resourceDomains: ["https://app.test", "https://db.test", "https://assets.claude.ai"] }, prefersBorder: false } },
  })
  expect((await client.listResources()).resources.map((r) => r.uri)).toEqual([uri])
  const stale = "ui://leafage/garden-previous"
  expect((await client.readResource({ uri: stale })).contents).toMatchObject([{ uri: stale, text: SHELL }])
  expect(structured(await call("show_garden"))).toEqual({ result: { plants: 0, need_water: [], attention: [] } })
})

test("tasks by status", async () => {
  const created = structured(await call("create_task", { title: "mcp task" })) as { result: { id: number }[] }
  const id = created.result[0]!.id
  expect(JSON.stringify(created)).not.toContain("owner_id")
  expect(structured(await call("tasks"))).toMatchObject({ result: [{ id, status: "todo" }] })
  await call("complete_task", { tasks: id })
  expect(structured(await call("tasks"))).toEqual({ result: [] })
  expect(structured(await call("tasks", { status: "done" }))).toMatchObject({ result: [{ id, status: "done" }] })
})

test("the three error codes come back as tool errors", async () => {
  const missing = await call("water", { plants: ["Nobody"] })
  expect(missing.isError).toBe(true)
  expect(structured(missing)).toMatchObject({ error: "not_found" })
  const duplicate = await call("create_pot", { label: "mcp pot" })
  expect(structured(duplicate)).toMatchObject({ error: "invalid_value", detail: { field: "label" } })
  const backwards = await call("update_pot", { pot: "mcp pot", patch: { drainage: false } })
  expect(structured(backwards)).toMatchObject({ error: "invalid_transition" })
})

test("malformed arguments are rejected before core", async () => {
  const bad = await call("water", { plants: 5 })
  expect(bad.isError).toBe(true)
  expect((bad.content[0] as { text?: string }).text).toContain("Input validation error")
})
