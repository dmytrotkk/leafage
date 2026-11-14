export type ErrorCode = "not_found" | "invalid_transition" | "invalid_value"

const CODES: ReadonlySet<string> = new Set<ErrorCode>(["not_found", "invalid_transition", "invalid_value"])

export class LeafageError extends Error {
  readonly code: ErrorCode
  readonly detail: Record<string, unknown>
  readonly hint: string

  constructor(code: ErrorCode, detail: Record<string, unknown>, hint: string) {
    super(code)
    this.name = "LeafageError"
    this.code = code
    this.detail = detail
    this.hint = hint
  }
}

export function toError(body: string): Error {
  const wire = parse<{ message?: unknown; details?: unknown; hint?: unknown }>(body) ?? {}
  if (typeof wire.message !== "string" || !CODES.has(wire.message)) return new Error(body || "request failed")
  const detail = typeof wire.details === "string" ? parse<Record<string, unknown>>(wire.details) : null
  return new LeafageError(wire.message as ErrorCode, detail ?? {}, typeof wire.hint === "string" ? wire.hint : "")
}

function parse<T>(text: string): T | null {
  try { return JSON.parse(text) as T } catch { return null }
}
