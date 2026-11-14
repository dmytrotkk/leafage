import { useSyncExternalStore } from "react"

type Listener = () => void
const listeners = new Set<Listener>()

function isDark(): boolean {
  return document.documentElement.classList.contains("dark")
}

export function setDark(next: boolean) {
  document.documentElement.classList.toggle("dark", next)
  try {
    localStorage.setItem("leafage-theme", next ? "dark" : "light")
  } catch {
  }
  for (const listener of listeners) listener()
}

function subscribe(listener: Listener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useTheme(): boolean {
  return useSyncExternalStore(subscribe, isDark)
}
