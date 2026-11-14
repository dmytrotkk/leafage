import { useState } from "react"
import { ArrowRight01Icon, CheckListIcon, Tick02Icon } from "@hugeicons/core-free-icons"
import { addDays, type DueRow } from "@leafage/core"

import { EmptyState, ErrorState, StatusLine } from "@/components/data-state"
import { Icon } from "@/components/icon"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardList, CardRow } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useMutations } from "@/hooks/use-mutations"
import { useQuery } from "@/hooks/use-query"
import { core } from "@/lib/core"
import { fmtDay, parseDay } from "@/lib/format"
import { TASK_KIND, TEXT } from "@/lib/labels"
import { cn } from "@/lib/utils"
import { href } from "@/router"

const DAYS = 7
const REFRESH_MS = 10_000
const OVERDUE = "overdue"
const UNDATED = "undated"
const GARDEN = "Garden"

const keyOf = (row: DueRow) => `${row.kind}:${row.task_id ?? row.plant_id ?? ""}:${row.item}`
const bucketOf = (row: DueRow, today: string) => (row.due_on === null ? UNDATED : row.due_on < today ? OVERDUE : row.due_on)
const daysBetween = (from: string, to: string) => Math.round((parseDay(to).getTime() - parseDay(from).getTime()) / 86_400_000)

function bucketTitle(bucket: string, today: string): string {
  if (bucket === OVERDUE) return "Overdue"
  if (bucket === UNDATED) return "No date"
  const offset = daysBetween(today, bucket)
  if (offset === 0) return "Today"
  if (offset === 1) return "Tomorrow"
  return `${parseDay(bucket).toLocaleDateString("en", { weekday: "long" })} · ${fmtDay(bucket)}`
}

function closer(row: DueRow): (() => Promise<string>) | null {
  if (row.task_id !== null) {
    const tasks = row.task_id
    return async () => {
      await core.complete_task({ tasks })
      return `Done: ${row.item}`
    }
  }
  if (row.plant_id === null) return null
  const plants = [row.plant_id]
  const who = row.name ?? "plant"
  if (row.kind === "water") {
    return async () => {
      await core.water({ plants })
      return `Watered ${who}`
    }
  }
  if (row.kind === "feed") {
    return async () => {
      await core.feed({ supplement: row.item, plants })
      return `Fed ${who} with ${row.item}`
    }
  }
  return null
}

function groupByPlant(rows: DueRow[]): [string, string | null, DueRow[]][] {
  const groups = new Map<string, [string | null, DueRow[]]>()
  for (const row of rows) {
    const name = row.name ?? GARDEN
    const group = groups.get(name) ?? [row.plant_id, []]
    group[1].push(row)
    groups.set(name, group)
  }
  return [...groups]
    .map(([name, [plantId, list]]): [string, string | null, DueRow[]] => [name, plantId, list])
    .sort((a, b) => Number(a[1] === null) - Number(b[1] === null) || a[0].localeCompare(b[0]))
}

function OpenPlant({ id, name }: { id: string; name: string | null }) {
  return (
    <Button variant="ghost" icon render={<a href={href.plant(id)} />} aria-label={`Open ${name}`}>
      <Icon icon={ArrowRight01Icon} aria-hidden />
    </Button>
  )
}

function Row({ row, today, busy, onClose }: { row: DueRow; today: string; busy: boolean; onClose: (close: () => Promise<string>) => void }) {
  const kind = TASK_KIND[row.kind]
  const close = closer(row)
  const late = row.due_on !== null && row.due_on < today
  return (
    <CardRow
      icon={kind.icon}
      tone={kind.tone}
      title={row.item}
      meta={late && row.due_on ? <span className={TEXT.red}>since {fmtDay(row.due_on)}</span> : undefined}
      action={
        close ? (
          <Button variant="secondary" icon aria-label={`Mark done: ${row.item}`} disabled={busy} onClick={() => onClose(close)}>
            <Icon icon={Tick02Icon} aria-hidden />
          </Button>
        ) : row.plant_id ? (
          <OpenPlant id={row.plant_id} name={row.name} />
        ) : undefined
      }
    />
  )
}

export function TasksScreen() {
  const [selected, setSelected] = useState<string | null>(null)
  const { data, error, retry } = useQuery(() => core.due({ days: DAYS }), [], REFRESH_MS)
  const { run, busy, status } = useMutations(retry)

  if (error) return <ErrorState error={error} retry={retry} />
  if (!data) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-16" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  const { rows, today } = data
  const buckets = new Map<string, DueRow[]>()
  for (const row of rows) {
    const bucket = bucketOf(row, today)
    buckets.set(bucket, [...(buckets.get(bucket) ?? []), row])
  }
  const week = Array.from({ length: DAYS }, (_, i) => addDays(today, i))
  const order = [OVERDUE, ...week, UNDATED]
  const cells = order.filter((b) => week.includes(b) || buckets.has(b))
  const overdue = buckets.get(OVERDUE)?.length ?? 0
  const visible = order.filter((b) => buckets.has(b) && (selected === null || selected === b))

  return (
    <div className="flex flex-col gap-6">
      <title>Tasks · leafage</title>
      <header>
        <h1 className="text-2xl font-medium tracking-tight">Tasks</h1>
        <p className="text-sm text-muted-foreground">
          {rows.length === 0 ? "Nothing due this week" : `${rows.length} due this week`}
          {overdue > 0 ? ` · ${overdue} overdue` : ""}
        </p>
      </header>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 [scrollbar-width:none]">
        {cells.map((bucket) => {
          const count = buckets.get(bucket)?.length ?? 0
          const active = selected === bucket
          const day = week.includes(bucket)
          return (
            <button
              key={bucket}
              type="button"
              aria-pressed={active}
              disabled={count === 0}
              onClick={() => setSelected(active ? null : bucket)}
              className={cn(
                "pressable flex min-w-16 shrink-0 cursor-pointer flex-col items-center rounded-lg p-2 ring-1 ring-foreground/[0.08] disabled:cursor-default disabled:opacity-40",
                active ? "bg-foreground text-background" : "bg-card hover:ring-foreground/[0.16]",
              )}
            >
              <span className={cn("text-xs", !active && "text-muted-foreground")}>
                {bucket === OVERDUE ? "Overdue" : bucket === UNDATED ? "No date" : bucket === today ? "Today" : parseDay(bucket).toLocaleDateString("en", { weekday: "short" })}
              </span>
              <span className={cn("text-base font-medium tabular-nums", bucket === OVERDUE && !active && count > 0 && TEXT.red)}>
                {day && bucket !== today ? parseDay(bucket).getDate() : count}
              </span>
              {day && bucket !== today ? <span className={cn("text-xs tabular-nums", !active && "text-muted-foreground")}>{count}</span> : null}
            </button>
          )
        })}
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={CheckListIcon} title="All caught up" body="Nothing is due in the next week." />
      ) : (
        visible.map((bucket) => {
          const list = buckets.get(bucket) ?? []
          return (
            <section key={bucket} className="flex flex-col gap-2">
              <h2 className="flex items-baseline gap-2 text-base font-medium">
                {bucketTitle(bucket, today)}
                <span className="text-sm font-normal text-muted-foreground tabular-nums">{list.length}</span>
              </h2>
              {groupByPlant(list).map(([name, plantId, group]) => (
                <Card key={name}>
                  <CardHeader title={name} action={plantId ? <OpenPlant id={plantId} name={name} /> : undefined} />
                  <CardList>
                    {group.map((row) => (
                      <Row key={keyOf(row)} row={row} today={today} busy={busy.has(keyOf(row))} onClose={(close) => void run(keyOf(row), close)} />
                    ))}
                  </CardList>
                </Card>
              ))}
            </section>
          )
        })
      )}

      <StatusLine status={status} />
    </div>
  )
}
