import { enums, type Enums } from "@leafage/core"

import { Icon } from "@/components/icon"
import { chip } from "@/components/ui/chip"
import { CONDITION, TONE, TREND } from "@/lib/labels"
import { cn } from "@/lib/utils"

const RADIUS = 6.5
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

function Ring({ fraction }: { fraction: number }) {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5 shrink-0 -rotate-90" aria-hidden>
      <circle cx="8" cy="8" r={RADIUS} fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
      <circle cx="8" cy="8" r={RADIUS} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeDasharray={`${CIRCUMFERENCE * fraction} ${CIRCUMFERENCE}`} />
    </svg>
  )
}

export function ConditionBadge({ condition, trend }: { condition: Enums["condition"] | null; trend: Enums["trend"] | null }) {
  const meta = condition ? CONDITION[condition] : null
  const fraction = condition ? (enums.condition.indexOf(condition) + 1) / enums.condition.length : 0
  const arrow = trend ? TREND[trend] : null
  return (
    <span title={arrow ? `${meta?.label ?? "Not assessed"} · ${arrow.label.toLowerCase()}` : undefined} className={cn(chip, "shrink-0", TONE[meta?.tone ?? "neutral"])}>
      <Ring fraction={fraction} />
      {meta?.label ?? "Not assessed"}
      {arrow ? <Icon icon={arrow.icon} className="size-3.5 opacity-70" aria-label={arrow.label} /> : null}
    </span>
  )
}
