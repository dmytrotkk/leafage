import { useMemo, useState, type Dispatch, type SetStateAction } from "react"
import { Activity01Icon, Clock01Icon, DropletIcon, Leaf01Icon, Plant02Icon, SortingAZ01Icon } from "@hugeicons/core-free-icons"
import { enums, type Enums, type GardenRow, type PlantFilter } from "@leafage/core"

import { Confirm } from "@/components/confirm"
import { EmptyState, ErrorState, StatusLine } from "@/components/data-state"
import { GardenView, type SortState } from "@/components/garden-view"
import { Icon } from "@/components/icon"
import { PlantCard, PlantCardSkeleton } from "@/components/plant-card"
import { SegmentStrip, type StripSegment } from "@/components/segment-strip"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Tile } from "@/components/ui/tile"
import { useMutations } from "@/hooks/use-mutations"
import { useQuery } from "@/hooks/use-query"
import { core } from "@/lib/core"
import { CONDITION, DOT, WATER_STATUS } from "@/lib/labels"
import { signPhotoField } from "@/lib/photos"
import { cn } from "@/lib/utils"

const SORT = [
  { key: "condition", label: "Condition", icon: Activity01Icon },
  { key: "name", label: "Name", icon: SortingAZ01Icon },
  { key: "updated", label: "Updated", icon: Clock01Icon },
] as const
type Sort = (typeof SORT)[number]["key"]
const DESC_BY_DEFAULT: Record<Sort, boolean> = { condition: false, name: false, updated: true }

const NONE = "none"
type ConditionKey = Enums["condition"] | typeof NONE
const CONDITIONS: readonly ConditionKey[] = [...enums.condition, NONE]
const conditionKey = (row: GardenRow): ConditionKey => row.condition ?? NONE
const rank = (c: Enums["condition"] | null) => (c ? enums.condition.indexOf(c) : enums.condition.length)
const waterRank = (s: Enums["water_status"] | null) => (s ? enums.water_status.indexOf(s) : enums.water_status.length)

const PRIMARY: Record<Sort, (a: GardenRow, b: GardenRow) => number> = {
  condition: (a, b) => rank(a.condition) - rank(b.condition),
  name: (a, b) => a.name.localeCompare(b.name),
  updated: (a, b) => (a.last_event_at ?? "").localeCompare(b.last_event_at ?? ""),
}

function sorted(rows: GardenRow[], sort: SortState<Sort>): GardenRow[] {
  const direction = sort.desc ? -1 : 1
  return [...rows].sort((a, b) => direction * PRIMARY[sort.key](a, b) || a.name.localeCompare(b.name))
}

function countBy<K extends string>(rows: GardenRow[], key: (row: GardenRow) => K | null): Map<K, number> {
  const map = new Map<K, number>()
  for (const row of rows) {
    const k = key(row)
    if (k) map.set(k, (map.get(k) ?? 0) + 1)
  }
  return map
}

const toggleIn = (set: Dispatch<SetStateAction<ReadonlySet<string>>>) => (key: string) =>
  set((prev) => {
    const next = new Set(prev)
    if (!next.delete(key)) next.add(key)
    return next
  })

function Legend({ segments, selected, onToggle }: { segments: StripSegment[]; selected: ReadonlySet<string>; onToggle: (key: string) => void }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2">
      {segments.map((seg) => (
        <button
          key={seg.key}
          type="button"
          aria-pressed={selected.has(seg.key)}
          onClick={() => onToggle(seg.key)}
          className={cn(
            "pressable flex cursor-pointer items-center gap-2 text-xs text-muted-foreground hover:text-foreground",
            selected.size > 0 && !selected.has(seg.key) && "opacity-40",
          )}
        >
          <span aria-hidden className={cn("size-2 rounded-full", seg.barClass)} />
          {seg.name}
          <span className="font-medium text-foreground tabular-nums">{seg.count}</span>
        </button>
      ))}
    </div>
  )
}

const GRID = "grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
const REFRESH_MS = 10_000

export function GardenScreen({ filter: initial = {} }: { filter?: PlantFilter | undefined }) {
  const [sort, setSort] = useState<SortState<Sort>>({ key: "condition", desc: false })
  const [filter, setFilter] = useState<PlantFilter>(initial)
  const [conditions, setConditions] = useState<ReadonlySet<string>>(new Set())
  const [waters, setWaters] = useState<ReadonlySet<string>>(new Set())
  const { data, error, loading, retry } = useQuery(async () => {
    const rows = await core.garden(filter)
    await signPhotoField(rows, "cover_url")
    return rows
  }, [filter], REFRESH_MS)
  const { run, busy, status } = useMutations(retry)

  const rows = data ?? []
  const conditionCounts = useMemo(() => countBy(rows, conditionKey), [rows])
  const waterCounts = useMemo(() => countBy(rows, (r) => r.water_status), [rows])
  const conditionSegments: StripSegment[] = CONDITIONS.filter((key) => conditionCounts.has(key)).map((key) => ({
    key,
    name: key === NONE ? "Not assessed" : CONDITION[key].label,
    barClass: key === NONE ? DOT.neutral : DOT[CONDITION[key].tone],
    count: conditionCounts.get(key) ?? 0,
  }))
  const waterSummary: StripSegment[] = enums.water_status
    .filter((key) => waterCounts.has(key))
    .map((key) => ({ key, name: WATER_STATUS[key].label, barClass: DOT[WATER_STATUS[key].tone], count: waterCounts.get(key) ?? 0 }))
  const waterUnits: StripSegment[] = useMemo(
    () =>
      rows
        .filter((r) => r.water_status !== null)
        .sort((a, b) => waterRank(a.water_status) - waterRank(b.water_status) || a.name.localeCompare(b.name))
        .map((r) => {
          const meta = WATER_STATUS[r.water_status ?? "ok"]
          return { key: r.plant_id, name: r.name, group: r.water_status ?? "ok", detail: meta.label, barClass: DOT[meta.tone] }
        }),
    [rows],
  )
  const needWater = (waterCounts.get("overdue") ?? 0) + (waterCounts.get("due") ?? 0)
  const attention = rows.filter((r) => r.attention).length
  const plants = useMemo(
    () =>
      sorted(
        rows.filter(
          (r) =>
            (conditions.size === 0 || conditions.has(conditionKey(r))) &&
            (waters.size === 0 || (r.water_status !== null && waters.has(r.water_status))),
        ),
        sort,
      ),
    [rows, conditions, waters, sort],
  )
  const filtering = Object.keys(filter).length > 0 || conditions.size > 0 || waters.size > 0
  const toggleCondition = toggleIn(setConditions)
  const toggleWater = toggleIn(setWaters)

  if (error) return <ErrorState error={error} retry={retry} />

  return (
    <div className="flex flex-col gap-6">
      <title>Garden · leafage</title>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium tracking-tight">Garden</h1>
          <p className="text-sm text-muted-foreground">
            {loading ? "Loading" : `${rows.length} plants`}
            {attention > 0 ? ` · ${attention} need attention` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Confirm
            label="Water all"
            title="Water the whole garden?"
            body="Logs a watering for every plant that has not been watered in the last 24 hours."
            action="Water all"
            onConfirm={() => void run("all", async () => `Watered ${(await core.water()).filter((r) => r.event_id !== null).length} plants`)}
            disabled={busy.has("all")}
          >
            <Icon icon={DropletIcon} />
          </Confirm>
          <GardenView
            sortOptions={SORT}
            sort={sort}
            onSort={(key) => setSort((prev) => ({ key, desc: prev.key === key ? !prev.desc : DESC_BY_DEFAULT[key] }))}
            filter={filter}
            onFilter={setFilter}
          />
        </div>
      </header>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <Tile label="Plants" icon={Plant02Icon} value={rows.length}>
            <div className="flex flex-col gap-2">
              <SegmentStrip segments={conditionSegments} selected={conditions} onToggle={toggleCondition} />
              <Legend segments={conditionSegments} selected={conditions} onToggle={toggleCondition} />
            </div>
          </Tile>
          <Tile label="Need water" icon={DropletIcon} value={needWater}>
            <div className="flex flex-col gap-2">
              <SegmentStrip className="max-sm:hidden" segments={waterUnits} selected={waters} onToggle={toggleWater} />
              <SegmentStrip className="sm:hidden" segments={waterSummary} selected={waters} onToggle={toggleWater} />
              <Legend segments={waterSummary} selected={waters} onToggle={toggleWater} />
            </div>
          </Tile>
        </div>
      )}

      <StatusLine status={status} />

      {loading ? (
        <div className={GRID}>
          {Array.from({ length: 6 }, (_, i) => (
            <PlantCardSkeleton key={i} />
          ))}
        </div>
      ) : plants.length === 0 ? (
        filtering ? (
          <div className="flex flex-col items-center gap-2">
            <EmptyState size="sm" icon={Leaf01Icon} title="No plants match" body="Try a different filter." />
            <Button
              variant="secondary"
              onClick={() => {
                setFilter({})
                setConditions(new Set())
                setWaters(new Set())
              }}
            >
              Clear filters
            </Button>
          </div>
        ) : (
          <EmptyState icon={Leaf01Icon} title="No plants yet" body="Add your first plant from the assistant and it will show up here." />
        )
      ) : (
        <div className={GRID}>
          {plants.map((plant) => (
            <PlantCard
              key={plant.plant_id}
              plant={plant}
              busy={busy.has(plant.plant_id)}
              onWater={() => void run(plant.plant_id, () => core.water({ plants: [plant.plant_id] }).then(() => null))}
            />
          ))}
        </div>
      )}
    </div>
  )
}
