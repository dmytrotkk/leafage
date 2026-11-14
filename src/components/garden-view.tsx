import { Popover } from "@base-ui/react/popover"
import { Alert02Icon, ArrowDown01Icon, ArrowUp01Icon, Bug01Icon, Home01Icon, SlidersHorizontalIcon, Sun03Icon } from "@hugeicons/core-free-icons"
import { enums, type PlantFilter } from "@leafage/core"

import { Icon, type IconSvgElement } from "@/components/icon"
import { Button } from "@/components/ui/button"
import { popup } from "@/components/ui/popup"
import { Toggle } from "@/components/ui/toggle"
import { DOT, FEED_STATUS, label, type Tone } from "@/lib/labels"
import { cn } from "@/lib/utils"

interface Option<T extends string> {
  key: T
  label: string
  icon?: IconSvgElement
  dot?: Tone
  trailing?: IconSvgElement
}

export interface SortState<S extends string> {
  key: S
  desc: boolean
}

function Group<T extends string>({ title, options, value, onChange }: { title: string; options: readonly Option<T>[]; value: T | undefined; onChange: (next: T | undefined) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = value === option.key
          return (
            <Toggle key={option.key} pressed={active} onClick={() => onChange(active && !option.trailing ? undefined : option.key)}>
              {option.icon ? <Icon icon={option.icon} aria-hidden /> : null}
              {option.dot ? <span aria-hidden className={cn("size-2 rounded-full", DOT[option.dot])} /> : null}
              {option.label}
              {option.trailing ? <Icon icon={option.trailing} className="opacity-70" aria-hidden /> : null}
            </Toggle>
          )
        })}
      </div>
    </div>
  )
}

const LOCATION_ICON: Record<(typeof enums.location_zone)[number], IconSvgElement> = { indoor: Home01Icon, balcony: Sun03Icon, quarantine: Bug01Icon }
const LOCATIONS = enums.location_zone.map((key) => ({ key, label: label(key), icon: LOCATION_ICON[key] }))
const FEED = enums.feed_status.map((key) => ({ key, label: FEED_STATUS[key].label, dot: FEED_STATUS[key].tone }))
const ATTENTION = [{ key: "true", label: "Needs attention", icon: Alert02Icon }] as const

export function GardenView<S extends string>({
  sortOptions,
  sort,
  onSort,
  filter,
  onFilter,
}: {
  sortOptions: readonly Option<S>[]
  sort: SortState<S>
  onSort: (key: S) => void
  filter: PlantFilter
  onFilter: (next: PlantFilter) => void
}) {
  const active = Object.keys(filter).length
  const sorts = sortOptions.map((o) => (o.key === sort.key ? { ...o, trailing: sort.desc ? ArrowDown01Icon : ArrowUp01Icon } : o))
  const set = <K extends keyof PlantFilter>(key: K, value: PlantFilter[K] | undefined) =>
    onFilter(Object.fromEntries(Object.entries({ ...filter, [key]: value }).filter(([, v]) => v !== undefined)) as PlantFilter)

  return (
    <Popover.Root>
      <Popover.Trigger render={<Button variant="secondary" />} aria-label="Sort and filter" className="data-[popup-open]:bg-foreground/[0.1]">
        <Icon icon={SlidersHorizontalIcon} />
        <span className="max-sm:hidden">View</span>
        {active > 0 ? <span className="flex size-4 items-center justify-center rounded-full bg-foreground text-xs font-medium text-background tabular-nums">{active}</span> : null}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="end" sideOffset={8} collisionPadding={16} className="isolate z-50">
          <Popover.Popup className={cn(popup, "flex w-[26rem] max-w-[calc(100vw-2rem)] flex-col gap-4 p-4")}>
            <Group title="Sort by" options={sorts} value={sort.key} onChange={(v) => v && onSort(v)} />
            <Group title="Location" options={LOCATIONS} value={filter.location} onChange={(v) => set("location", v)} />
            <Group title="Attention" options={ATTENTION} value={filter.attention ? "true" : undefined} onChange={(v) => set("attention", v ? true : undefined)} />
            <Group title="Feed" options={FEED} value={filter.feed_status} onChange={(v) => set("feed_status", v)} />
            {active > 0 ? (
              <Button variant="ghost" className="self-start" onClick={() => onFilter({})}>
                Clear filters
              </Button>
            ) : null}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
