import { createMcpHandler } from "@modelcontextprotocol/server"

import { signIn } from "../test/session"
import { createServer } from "../worker/tools"

const port = Number(process.env.PORT ?? 8788)
const origin = `http://localhost:${port}`
const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-expose-headers": "*" }

const { core } = await signIn()
const shell = async () => (await Bun.file("dist/client/embed.html").text()).replaceAll('"/assets/', `"${origin}/assets/`)
const mcp = createMcpHandler(() => createServer(core, "leafage", "dev", { origin, storage: process.env.VITE_SUPABASE_URL!, build: "dev", shell }))

Bun.serve({
  port,
  async fetch(request) {
    if (request.method === "OPTIONS") return new Response(null, { headers: cors })
    const { pathname } = new URL(request.url)
    const response =
      pathname === "/mcp"
        ? await mcp.fetch(request, { authInfo: { token: "dev", clientId: "dev", scopes: [] } })
        : new Response(Bun.file(`dist/client${pathname}`))
    for (const [name, value] of Object.entries(cors)) response.headers.set(name, value)
    return response
  },
})

console.log(`test-account MCP on ${origin}/mcp`)
