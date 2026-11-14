import { useRef } from "react"
import { Bug01Icon, DropletIcon, FlaskConicalIcon, FlowerPotIcon, Sun03Icon } from "@hugeicons/core-free-icons"
import type { GardenRow } from "@leafage/core"

import { ConditionBadge } from "@/components/condition-badge"
import { Emblem } from "@/components/emblem"
import { Icon, type IconSvgElement } from "@/components/icon"
import { Card, CardMedia } from "@/components/ui/card"
import { Chip } from "@/components/ui/chip"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { capitalize, relDue } from "@/lib/format"
import { FEED_STATUS, TEXT, WATER_STATUS, label, type Tone } from "@/lib/labels"
import { cn } from "@/lib/utils"
import { href } from "@/router"

function waterLine(row: GardenRow): { text: string; tone: Tone } {
  const tone = row.water_status ? WATER_STATUS[row.water_status].tone : "neutral"
  if (!row.last_watered_at) return { text: "Never watered", tone }
  if (!row.water_due_on) return { text: "No schedule", tone: "neutral" }
  const today = new Date(row.last_watered_at).toDateString() === new Date().toDateString()
  if (today && row.water_status !== "overdue" && row.water_status !== "due") return { text: "Watered today", tone }
  const rel = relDue(row.water_due_on)
  return { text: rel.tone === "late" ? capitalize(rel.label) : `Due ${rel.label}`, tone }
}

interface Concern {
  label: string
  tone: Tone
  icon: IconSvgElement
}

function concerns(row: GardenRow): Concern[] {
  return [
    ...row.pests.filter((p) => p.status !== "cleared").map((p) => ({ label: label(p.pest), tone: "red" as const, icon: Bug01Icon })),
    ...(row.repot_due ? [{ label: "Repot due", tone: "amber" as const, icon: FlowerPotIcon }] : []),
    ...(row.pot_sealed ? [{ label: "No drainage", tone: "amber" as const, icon: FlowerPotIcon }] : []),
    ...(row.light_below_need ? [{ label: "Needs more light", tone: "amber" as const, icon: Sun03Icon }] : []),
  ]
}

function feedLine(row: GardenRow): { text: string; tone: Tone } {
  const alert = row.feed_alert && FEED_STATUS[row.feed_alert]
  if (alert) return { text: `Feed ${alert.label.toLowerCase()}`, tone: alert.tone }
  return { text: row.never_fed ? "No feed due, never fed" : "No feed due", tone: "neutral" }
}

function WaterButton({ plant, busy, onWater }: { plant: GardenRow; busy: boolean; onWater: () => void }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label={`Mark ${plant.name} watered`}
            disabled={busy}
            onClick={onWater}
            className={cn(
              "glass pressable absolute top-4 right-4 z-10 flex size-9 cursor-pointer items-center justify-center rounded-full disabled:cursor-default disabled:opacity-60",
              plant.water_status ? TEXT[WATER_STATUS[plant.water_status].tone] : "text-foreground",
            )}
          />
        }
      >
        <Icon icon={DropletIcon} className={cn("size-4.5", busy && "animate-pulse")} aria-hidden />
      </TooltipTrigger>
      <TooltipContent>Mark watered</TooltipContent>
    </Tooltip>
  )
}

export function PlantCard({ plant, busy, onWater }: { plant: GardenRow; busy: boolean; onWater: () => void }) {
  const link = useRef<HTMLAnchorElement>(null)
  const water = waterLine(plant)
  const feed = feedLine(plant)
  const [first, second, ...rest] = concerns(plant)
  const identity = [
    capitalize(plant.common ?? "Unidentified"),
    plant.individuals > 1 && `${plant.individuals} plants`,
    plant.location && label(plant.location),
  ]
    .filter(Boolean)
    .join(" · ")
  return (
    <Card className="group relative h-full transition-[background-color,box-shadow] duration-200 hover:bg-accent/50 hover:ring-foreground/[0.14] has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring">
      <a ref={link} href={href.plant(plant.plant_id)} aria-label={`Open ${plant.name}`} className="absolute inset-0 z-[1] rounded-lg outline-none" />
      <div className="relative">
        <CardMedia src={plant.cover_url} fallback={<Emblem common={plant.common} emoji={plant.emoji} size="lg" />} />
        <WaterButton plant={plant} busy={busy} onWater={onWater} />
      </div>
      <div className="relative flex min-w-0 flex-1 flex-col gap-4 px-4 pt-2 pb-4">
        {plant.cover_url ? (
          <img
            src={plant.cover_url}
            alt=""
            aria-hidden
            className="pointer-events-none absolute inset-x-0 -top-14 -z-10 h-40 w-full scale-125 object-cover opacity-50 blur-2xl saturate-200 [mask-image:linear-gradient(to_bottom,#000_20%,transparent)]"
          />
        ) : null}
        <div className="flex min-w-0 items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-2" title={identity}>
            <Emblem common={plant.common} emoji={plant.emoji} />
            <span className="truncate text-xl font-medium tracking-tight">{plant.name}</span>
          </span>
          <ConditionBadge condition={plant.condition} trend={plant.trend} />
        </div>
        <div className="relative z-10 mt-auto flex cursor-pointer items-center gap-2 overflow-hidden" onClick={() => link.current?.click()}>
          <Chip tone={water.tone} icon={DropletIcon} title={water.text} />
          <Chip tone={feed.tone} icon={FlaskConicalIcon} title={feed.text} />
          {first ? (
            <>
              <span aria-hidden className="h-4 w-px shrink-0 bg-foreground/[0.08]" />
              <Chip tone={first.tone} icon={first.icon} title={first.label}>
                {first.label}
              </Chip>
              {second ? (
                <Chip tone={second.tone} title={[second, ...rest].map((c) => c.label).join(", ")} className="shrink-0">
                  +{rest.length + 1}
                </Chip>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </Card>
  )
}

export function PlantCardSkeleton() {
  return (
    <Card>
      <Skeleton className="m-2 aspect-4/3 rounded-inset" />
      <div className="flex flex-col gap-4 px-4 pt-2 pb-4">
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-7 w-1/2" />
          <Skeleton className="h-7 w-20 rounded-full" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="size-7 rounded-full" />
          <Skeleton className="size-7 rounded-full" />
        </div>
      </div>
    </Card>
  )
}
