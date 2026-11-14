import {
  ArrowDownRight01Icon,
  ArrowUpRight01Icon,
  Bug01Icon,
  Camera01Icon,
  CheckListIcon,
  DropletIcon,
  EyeIcon,
  FlaskConicalIcon,
  FlowerPotIcon,
  Location01Icon,
  MinusSignIcon,
  Scissor01Icon,
  ShoppingCart01Icon,
  ShovelIcon,
  SprayCanIcon,
  StethoscopeIcon,
  StickyNote02Icon,
  Sun03Icon,
  TapeMeasureIcon,
} from "@hugeicons/core-free-icons"
import type { Enums } from "@leafage/core"

import type { IconSvgElement } from "@/components/icon"
import { capitalize } from "@/lib/format"

export type Tone = "red" | "orange" | "amber" | "lime" | "green" | "blue" | "violet" | "pink" | "cyan" | "neutral"
interface Meta {
  label: string
  tone: Tone
}

export const TONE: Record<Tone, string> = {
  red: "bg-red-500/10 text-red-600 dark:text-red-400",
  orange: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  lime: "bg-lime-500/10 text-lime-600 dark:text-lime-400",
  green: "bg-green-500/10 text-green-600 dark:text-green-400",
  blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  violet: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  pink: "bg-pink-500/10 text-pink-600 dark:text-pink-400",
  cyan: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
  neutral: "bg-foreground/[0.06] text-muted-foreground",
}

export const TEXT: Record<Tone, string> = {
  red: "text-red-600 dark:text-red-400",
  orange: "text-orange-600 dark:text-orange-400",
  amber: "text-amber-600 dark:text-amber-400",
  lime: "text-lime-600 dark:text-lime-400",
  green: "text-green-600 dark:text-green-400",
  blue: "text-blue-600 dark:text-blue-400",
  violet: "text-violet-600 dark:text-violet-400",
  pink: "text-pink-600 dark:text-pink-400",
  cyan: "text-cyan-600 dark:text-cyan-400",
  neutral: "text-muted-foreground",
}

export const DOT: Record<Tone, string> = {
  red: "bg-red-500",
  orange: "bg-orange-500",
  amber: "bg-amber-500",
  lime: "bg-lime-500",
  green: "bg-green-500",
  blue: "bg-blue-500",
  violet: "bg-violet-500",
  pink: "bg-pink-500",
  cyan: "bg-cyan-500",
  neutral: "bg-foreground/25",
}

export const label = (value: string) => capitalize(value.replaceAll("_", " "))

export const CONDITION: Record<Enums["condition"], Meta> = {
  critical: { label: "Critical", tone: "red" },
  poor: { label: "Poor", tone: "orange" },
  stressed: { label: "Stressed", tone: "amber" },
  good: { label: "Good", tone: "lime" },
  thriving: { label: "Thriving", tone: "green" },
}

export const WATER_STATUS: Record<Enums["water_status"], Meta> = {
  overdue: { label: "Overdue", tone: "red" },
  due: { label: "Due today", tone: "orange" },
  soon: { label: "Due soon", tone: "amber" },
  ok: { label: "On schedule", tone: "blue" },
}

export const FEED_STATUS: Record<Enums["feed_status"], Meta> = {
  overdue: { label: "Overdue", tone: "red" },
  due: { label: "Due", tone: "amber" },
  recommended: { label: "Recommended", tone: "violet" },
  scheduled: { label: "Scheduled", tone: "green" },
  held: { label: "Held", tone: "neutral" },
  off_season: { label: "Off season", tone: "neutral" },
}

export const TREND: Record<Enums["trend"], { label: string; icon: IconSvgElement }> = {
  improving: { label: "Improving", icon: ArrowUpRight01Icon },
  steady: { label: "Steady", icon: MinusSignIcon },
  declining: { label: "Declining", icon: ArrowDownRight01Icon },
}

export const POT_FIT: Record<Enums["pot_fit"], Meta> = {
  unplanned: { label: "No repot planned", tone: "neutral" },
  step_up: { label: "Step up", tone: "amber" },
  undersized: { label: "Undersized", tone: "red" },
}

export const ORIGIN: Record<Enums["origin_type"], string> = {
  seed: "Grown from seed",
  cutting: "From a cutting",
  graft: "Grafted",
  nursery: "From a nursery",
}

export const LIGHT: Record<Enums["light_level"], string> = {
  bright_shade: "Bright shade",
  part_sun: "Part sun",
  full_sun: "Full sun",
}

export const WATER_REGIME: Record<Enums["water_regime"], string> = {
  drought_tolerant: "Drought tolerant",
  dry_top: "Dry top between waterings",
  evenly_moist: "Evenly moist",
}

export const TASK_KIND: Record<Enums["task_kind"], Meta & { icon: IconSvgElement }> = {
  water: { label: "Water", tone: "blue", icon: DropletIcon },
  feed: { label: "Feed", tone: "green", icon: FlaskConicalIcon },
  pest: { label: "Pest", tone: "violet", icon: Bug01Icon },
  pot: { label: "Pot", tone: "orange", icon: FlowerPotIcon },
  light: { label: "Light", tone: "amber", icon: Sun03Icon },
  prune: { label: "Prune", tone: "pink", icon: Scissor01Icon },
  inspect: { label: "Inspect", tone: "neutral", icon: EyeIcon },
  photo: { label: "Photo", tone: "neutral", icon: Camera01Icon },
  shop: { label: "Shop", tone: "cyan", icon: ShoppingCart01Icon },
  other: { label: "Other", tone: "neutral", icon: CheckListIcon },
}

export const EVENT: Record<Enums["event_type"], Meta & { icon: IconSvgElement }> = {
  watering: { label: "Watered", tone: "blue", icon: DropletIcon },
  feed: { label: "Fed", tone: "green", icon: FlaskConicalIcon },
  treatment: { label: "Treated", tone: "violet", icon: SprayCanIcon },
  repot: { label: "Repotted", tone: "orange", icon: ShovelIcon },
  prune: { label: "Pruned", tone: "pink", icon: Scissor01Icon },
  measure: { label: "Measured", tone: "cyan", icon: TapeMeasureIcon },
  diagnosis: { label: "Diagnosis", tone: "red", icon: StethoscopeIcon },
  move: { label: "Moved", tone: "amber", icon: Location01Icon },
  photo: { label: "Photo", tone: "neutral", icon: Camera01Icon },
  note: { label: "Note", tone: "neutral", icon: StickyNote02Icon },
}
