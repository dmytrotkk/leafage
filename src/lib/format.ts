const DAY_MS = 86_400_000

export function parseDay(day: string): Date {
  const [y = 0, m = 1, d = 1] = day.split("-").map(Number)
  return new Date(y, m - 1, d)
}

function daysFromToday(day: string): number {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((parseDay(day).getTime() - today.getTime()) / DAY_MS)
}

function fmtShortDate(d: Date): string {
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return d.toLocaleDateString("en", { month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }) })
}

export function fmtDay(day: string): string {
  return fmtShortDate(parseDay(day))
}

export function relDue(day: string): { label: string; tone: "late" | "today" | "later" } {
  const rel = daysFromToday(day)
  if (rel < 0) return { label: `${-rel}d overdue`, tone: "late" }
  if (rel === 0) return { label: "today", tone: "today" }
  return { label: rel === 1 ? "tomorrow" : `in ${rel}d`, tone: "later" }
}

export function fmtTimestamp(ts: string): string {
  const d = new Date(ts)
  const time = d.toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit", hour12: false })
  return `${fmtShortDate(d)} · ${time}`
}

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export function monthShort(month: number): string {
  return new Date(2000, month - 1, 1).toLocaleDateString("en", { month: "short" })
}
