import { useSyncExternalStore } from "react"
import { flushSync } from "react-dom"
import type { PlantFilter } from "@leafage/core"

export type Route =
  | { screen: "garden"; filter?: PlantFilter }
  | { screen: "plant"; id: string }
  | { screen: "tasks" }
  | { screen: "account" }

export const href = {
  garden: "#/",
  plant: (id: string) => `#/plant/${encodeURIComponent(id)}`,
  tasks: "#/tasks",
  account: "#/account",
}

export function parseRoute(hash: string): Route {
  const segments = hash.replace(/^#/, "").split("/").filter(Boolean)
  if (segments[0] === "plant" && segments[1]) {
    return { screen: "plant", id: decodeURIComponent(segments[1]) }
  }
  if (segments[0] === "tasks") return { screen: "tasks" }
  if (segments[0] === "account") return { screen: "account" }
  return { screen: "garden" }
}

let route = parseRoute(location.hash)
const listeners = new Set<() => void>()

export function navigate(next: Route, animate = true): void {
  const apply = () => {
    route = next
    for (const notify of listeners) notify()
    document.getElementById("app-scroll")?.scrollTo(0, 0)
    window.scrollTo(0, 0)
  }
  if (!animate || typeof document.startViewTransition !== "function" || matchMedia("(prefers-reduced-motion: reduce)").matches) apply()
  else document.startViewTransition(() => flushSync(apply))
}

function subscribe(notify: () => void) {
  listeners.add(notify)
  return () => listeners.delete(notify)
}

export const useRoute = () => useSyncExternalStore(subscribe, () => route)
