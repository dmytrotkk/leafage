import { fmtTimestamp } from "@/lib/format"

export interface Point {
  ts: string
  value: number
}

const day = (ts: string) => new Date(ts).toLocaleDateString("en", { month: "short", day: "numeric" })

export function HistoryChart({
  points,
  format,
  domain,
  ticks,
  step = false,
}: {
  points: Point[]
  format: (value: number) => string
  domain?: [number, number]
  ticks?: number[]
  step?: boolean
}) {
  const values = points.map((p) => p.value)
  const [low, high] = domain ?? [Math.min(...values), Math.max(...values)]
  const x = (i: number) => (i / (points.length - 1)) * 100
  const y = (value: number) => (1 - (value - low) / (high - low || 1)) * 100
  const [first, last] = [points[0], points.at(-1)]
  const line = points.map((p, i) => (step && i > 0 ? `H${x(i)}V${y(p.value)}` : `${i > 0 ? "L" : "M"}${x(i)},${y(p.value)}`)).join("")
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 text-xs text-muted-foreground">
      <div className="flex flex-col-reverse justify-between text-right">
        {(ticks ?? [...new Set([low, high])]).map((tick) => (
          <span key={tick}>{format(tick)}</span>
        ))}
      </div>
      <svg
        role="img"
        aria-label={first && last ? `${format(first.value)} on ${day(first.ts)} to ${format(last.value)} on ${day(last.ts)}` : undefined}
        className="my-2 h-28 w-full overflow-visible text-foreground"
      >
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" overflow="visible">
          <path d={line} fill="none" stroke="currentColor" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
        </svg>
        {points.map((p, i) => (
          <circle key={i} cx={`${x(i)}%`} cy={`${y(p.value)}%`} r={3} fill="currentColor">
            <title>{`${format(p.value)} · ${fmtTimestamp(p.ts)}`}</title>
          </circle>
        ))}
      </svg>
      <div className="col-start-2 flex justify-between">
        {[first, last].map((p, i) => (p ? <span key={i}>{day(p.ts)}</span> : null))}
      </div>
    </div>
  )
}
