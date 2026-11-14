import { PHOTO_TTL_SECONDS } from "@leafage/core"

import { core } from "./core"

const REFRESH_SKEW_MS = 60_000

const cache = new Map<string, { url: string; expiresAt: number }>()

export function clearPhotoCache(): void {
  cache.clear()
}

async function signPhotoRefs(
  refs: Iterable<string | null | undefined>,
): Promise<Map<string, string>> {
  const unique = [...new Set([...refs].filter((r): r is string => !!r))]
  const out = new Map<string, string>()
  if (unique.length === 0) return out

  const now = Date.now()
  const stale: string[] = []
  for (const ref of unique) {
    const hit = cache.get(ref)
    if (hit && hit.expiresAt > now) out.set(ref, hit.url)
    else stale.push(ref)
  }
  if (stale.length === 0) return out

  const signed = await core.photo_urls({ paths: stale }).catch(() => null)
  if (!signed) return out

  const expiresAt = now + PHOTO_TTL_SECONDS * 1000 - REFRESH_SKEW_MS
  for (const [ref, url] of Object.entries(signed)) {
    cache.set(ref, { url, expiresAt })
    out.set(ref, url)
  }
  return out
}

export async function signPhotoField<
  K extends string,
  T extends Record<K, string | null>,
>(items: T[], key: K): Promise<void> {
  const signed = await signPhotoRefs(items.map((item) => item[key]))
  for (const item of items) {
    const ref = item[key]
    if (ref) item[key] = (signed.get(ref) ?? ref) as T[K]
  }
}
