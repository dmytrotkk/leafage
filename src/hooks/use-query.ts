import { useCallback, useEffect, useRef, useState } from "react"

const EMPTY = { data: null, error: null }

export function useQuery<T>(fetcher: () => Promise<T>, deps: readonly unknown[], refreshMs?: number) {
  const [state, setState] = useState<{ data: T | null; error: unknown }>(EMPTY)
  const fnRef = useRef(fetcher)
  fnRef.current = fetcher
  const runId = useRef(0)

  const load = useCallback((quiet = false) => {
    const id = ++runId.current
    if (!quiet) setState((s) => (s.error == null ? s : EMPTY))
    fnRef.current().then(
      (data) => {
        if (id === runId.current) setState({ data, error: null })
      },
      (error: unknown) => {
        if (id === runId.current) setState((s) => (quiet && s.data != null ? s : { data: null, error }))
      },
    )
  }, [])

  useEffect(() => load(), deps)

  useEffect(() => {
    if (!refreshMs) return
    let onScreen = true
    const refresh = () => {
      if (onScreen && document.visibilityState === "visible") load(true)
    }
    const observer = new IntersectionObserver(([entry]) => {
      const returning = !onScreen
      onScreen = entry?.isIntersecting ?? onScreen
      if (returning) refresh()
    })
    observer.observe(document.documentElement)
    const timer = setInterval(refresh, refreshMs)
    document.addEventListener("visibilitychange", refresh)
    return () => {
      clearInterval(timer)
      observer.disconnect()
      document.removeEventListener("visibilitychange", refresh)
    }
  }, [refreshMs, load])

  const retry = useCallback(() => load(), [load])

  return { ...state, loading: state.data == null && state.error == null, retry }
}
