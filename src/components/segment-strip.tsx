import { cn } from "@/lib/utils"

export interface StripSegment {
  key: string
  name: string
  barClass: string
  count?: number
  detail?: string
  group?: string
}

export function SegmentStrip({
  segments,
  selected,
  onToggle,
  className,
}: {
  segments: StripSegment[]
  selected: ReadonlySet<string>
  onToggle: (key: string) => void
  className?: string
}) {
  if (segments.length === 0) return null
  return (
    <div className={cn("flex h-2 items-stretch gap-1", className)}>
      {segments.map((seg, i) => {
        const toggleKey = seg.group ?? seg.key
        const label = `${seg.name}: ${seg.detail ?? seg.count}`
        return (
          <button
            key={seg.key}
            type="button"
            title={label}
            aria-label={label}
            aria-pressed={selected.has(toggleKey)}
            onClick={() => onToggle(toggleKey)}
            className={cn(
              "min-w-2 origin-center animate-strip-in cursor-pointer rounded-full transition-[scale,opacity] hover:scale-y-125 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none motion-reduce:animate-none",
              selected.size > 0 && !selected.has(toggleKey) && "opacity-30 hover:opacity-70",
              seg.barClass,
            )}
            style={{ flexGrow: seg.count ?? 1, flexBasis: 0, animationDelay: `${i * 20}ms` }}
          />
        )
      })}
    </div>
  )
}
