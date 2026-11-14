import { useState } from "react"
import { LeafageError } from "@leafage/core"

import { label } from "@/lib/labels"

export interface Status {
  error: boolean
  text: string
}

export function failure(err: unknown): string {
  if (err instanceof LeafageError) return err.hint || label(err.code)
  return err instanceof Error ? err.message : "Something went wrong"
}

export function useMutations(reload: () => void) {
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set())
  const [status, setStatus] = useState<Status | null>(null)
  async function run(key: string, action: () => Promise<string | null>) {
    setBusy((prev) => new Set(prev).add(key))
    setStatus(null)
    try {
      const text = await action()
      if (text !== null) setStatus({ error: false, text })
      reload()
    } catch (err) {
      setStatus({ error: true, text: failure(err) })
    } finally {
      setBusy((prev) => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
    }
  }
  return { run, busy, status }
}
