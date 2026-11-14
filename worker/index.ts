import { createMcpHandler, type McpHttpHandler } from "@modelcontextprotocol/server"
import { createCore, createTransport } from "@leafage/core"

import pkg from "../package.json" with { type: "json" }

import { gate, protectedResourceMetadata } from "./auth"
import { createServer } from "./tools"

declare const __BUILD__: string

interface Env {
  SUPABASE_URL: string
  SUPABASE_PUBLISHABLE_KEY: string
  ASSETS: Fetcher
}

let mcp: McpHttpHandler | null = null

function mcpHandler(env: Env): McpHttpHandler {
  mcp ??= createMcpHandler(({ authInfo, requestInfo }) => {
    if (!authInfo || !requestInfo) throw new Error("Unauthenticated request reached the MCP handler")
    const { origin } = new URL(requestInfo.url)
    const transport = createTransport({ url: env.SUPABASE_URL, key: env.SUPABASE_PUBLISHABLE_KEY, token: async () => authInfo.token })
    return createServer(createCore(transport), pkg.name, pkg.version, {
      origin,
      storage: env.SUPABASE_URL,
      build: __BUILD__,
      shell: async () => (await (await env.ASSETS.fetch(`${origin}/embed`)).text()).replaceAll('"/assets/', `"${origin}/assets/`),
    })
  })
  return mcp
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === "/.well-known/oauth-protected-resource" || url.pathname === "/.well-known/oauth-protected-resource/mcp") {
      return protectedResourceMetadata(url.origin, env.SUPABASE_URL)
    }

    if (url.pathname === "/mcp") {
      const auth = await gate(url.origin, env.SUPABASE_URL)(request)
      if (auth instanceof Response) return auth
      return mcpHandler(env).fetch(request, { authInfo: auth })
    }

    return env.ASSETS.fetch(request)
  },

  async scheduled(_controller, env): Promise<void> {
    await fetch(`${env.SUPABASE_URL}/rest/v1/plants?select=id&limit=1`, {
      headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY },
    })
  },
} satisfies ExportedHandler<Env>
