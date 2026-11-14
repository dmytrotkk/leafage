import type { App } from "@modelcontextprotocol/ext-apps"
import { LeafageError, type Core, type ErrorCode } from "@leafage/core"

interface Wire {
  result?: unknown
  error?: ErrorCode
  detail?: Record<string, unknown>
  hint?: string
}

export function createBridge(app: App): Core {
  async function call(name: string, input: unknown = {}): Promise<unknown> {
    const result = await app.callServerTool({ name, arguments: input as Record<string, unknown> })
    const wire = (result.structuredContent ?? {}) as Wire
    if (!result.isError) return wire.result
    if (wire.error) throw new LeafageError(wire.error, wire.detail ?? {}, wire.hint ?? "")
    const [first] = result.content
    throw new Error(first?.type === "text" ? first.text : "Request failed")
  }
  return new Proxy({} as Core, { get: (_, name: string) => (input?: unknown) => call(name, input) })
}
