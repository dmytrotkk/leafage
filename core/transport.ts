import { toError } from "./errors"

type Init = { method?: string; headers?: Record<string, string>; body?: string }
type Res = { ok: boolean; headers: { get(name: string): string | null }; text(): Promise<string> }
declare const fetch: (url: string, init?: Init) => Promise<Res>

export interface Transport {
  select<T>(relation: string, query: Record<string, string>, opts?: { single?: boolean }): Promise<T>
  patch<T>(relation: string, query: Record<string, string>, body: unknown): Promise<T>
  rpc<T>(name: string, args?: unknown): Promise<T>
  sign(bucket: string, paths: string[], expiresIn: number): Promise<Record<string, string>>
}

const SINGLE = { accept: "application/vnd.pgrst.object+json" }
const JSON_BODY = { "content-type": "application/json" }

const search = (query: Record<string, string>) =>
  Object.entries(query)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&")

export function createTransport({ url, key, token }: { url: string; key: string; token: () => Promise<string> }): Transport {
  async function send(path: string, init: Init, api = "rest/v1"): Promise<Res> {
    const res = await fetch(`${url}/${api}/${path}`, {
      ...init,
      headers: { ...init.headers, apikey: key, authorization: `Bearer ${await token()}` },
    })
    if (!res.ok) throw toError(await res.text())
    return res
  }

  async function json<T>(path: string, init: Init): Promise<T> {
    const body = await (await send(path, init)).text()
    return (body ? JSON.parse(body) : undefined) as T
  }

  return {
    select<T>(relation: string, query: Record<string, string>, opts?: { single?: boolean }): Promise<T> {
      return json<T>(`${relation}?${search(query)}`, { headers: opts?.single ? SINGLE : {} })
    },
    patch<T>(relation: string, query: Record<string, string>, body: unknown): Promise<T> {
      const headers = { ...SINGLE, ...JSON_BODY, prefer: "return=representation" }
      return json<T>(`${relation}?${search(query)}`, { method: "PATCH", headers, body: JSON.stringify(body) })
    },
    rpc<T>(name: string, args?: unknown): Promise<T> {
      return json<T>(`rpc/${name}`, { method: "POST", headers: JSON_BODY, body: JSON.stringify(args ?? {}) })
    },
    async sign(bucket: string, paths: string[], expiresIn: number): Promise<Record<string, string>> {
      const res = await send(`object/sign/${bucket}`, { method: "POST", headers: JSON_BODY, body: JSON.stringify({ expiresIn, paths }) }, "storage/v1")
      const signed = JSON.parse(await res.text()) as { path: string; signedURL: string | null }[]
      return Object.fromEntries(signed.flatMap((s) => (s.signedURL ? [[s.path, encodeURI(`${url}/storage/v1${s.signedURL}`)]] : [])))
    },
  }
}
