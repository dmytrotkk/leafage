import { useEffect, useRef } from "react"
import {
  Activity01Icon,
  Analytics01Icon,
  Bug01Icon,
  Camera01Icon,
  CheckListIcon,
  Clock01Icon,
  DropletIcon,
  FlaskConicalIcon,
  FlowerPotIcon,
  Leaf01Icon,
  PinIcon,
  StickyNote02Icon,
  Sun03Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"
import { LeafageError, enums, type Catalog, type Enums, type PlanRow, type PlantDetail, type PotRow, type Task, type TypedEvent } from "@leafage/core"

import { EmptyState, ErrorState, StatusLine } from "@/components/data-state"
import { Emblem } from "@/components/emblem"
import { EventRow, lookups } from "@/components/event-row"
import { HistoryChart, type Point } from "@/components/history-chart"
import { Icon, type IconSvgElement } from "@/components/icon"
import { Button } from "@/components/ui/button"
import { Card, CardBody, CardHeader, CardList, CardRow } from "@/components/ui/card"
import { Chip } from "@/components/ui/chip"
import { Fact } from "@/components/ui/fact"
import { Skeleton } from "@/components/ui/skeleton"
import { Tile } from "@/components/ui/tile"
import { useMutations } from "@/hooks/use-mutations"
import { useQuery } from "@/hooks/use-query"
import { core } from "@/lib/core"
import { fmtDay, fmtTimestamp, monthShort, parseDay, relDue } from "@/lib/format"
import { CONDITION, FEED_STATUS, LIGHT, ORIGIN, POT_FIT, TASK_KIND, TEXT, TREND, WATER_REGIME, WATER_STATUS, label, type Tone } from "@/lib/labels"
import { signPhotoField } from "@/lib/photos"
import { cn } from "@/lib/utils"
import { href } from "@/router"

const conditionIndex = (c: Enums["condition"]) => enums.condition.indexOf(c)
const conditionName = (i: number) => (enums.condition[i] ? CONDITION[enums.condition[i]].label : "")

function since(date: string, precision: Enums["date_precision"] | null): string {
  const d = parseDay(date)
  const now = new Date()
  const when = precision === "year" ? String(d.getFullYear()) : precision === "month" ? d.toLocaleDateString("en", { month: "short", year: "numeric" }) : fmtDay(date)
  const months = (now.getFullYear() - d.getFullYear()) * 12 + now.getMonth() - d.getMonth()
  const age = months >= 24 ? `${Math.floor(months / 12)} years` : months >= 1 ? `${months} months` : "new"
  return `since ${when}, ${age}`
}

function originLine(row: PlantDetail): string {
  return [row.origin && ORIGIN[row.origin], row.origin_date && since(row.origin_date, row.origin_date_precision)].filter(Boolean).join(", ")
}

function waterSuffix(status: Enums["water_status"] | null, day: string): string | null {
  if (status === "overdue") return `since ${fmtDay(day)}`
  if (status === "due") return null
  const rel = relDue(day).label
  return status === "ok" ? `next ${rel}` : rel
}

function dueLine(day: string | null): string {
  if (!day) return "No schedule"
  return `${fmtDay(day)} · ${relDue(day).label}`
}

interface Stat {
  label: string
  icon: IconSvgElement
  value: string
  detail: string | null
  tone: Tone | null
}

function stats(row: PlantDetail, plan: PlanRow[]): Stat[] {
  const condition = row.condition && CONDITION[row.condition]
  const trend = row.trend && TREND[row.trend]
  const water = row.water_status && WATER_STATUS[row.water_status]
  const feed = row.feed_alert && FEED_STATUS[row.feed_alert]
  const fit = POT_FIT[row.pot_fit]
  return [
    { label: "Condition", icon: Activity01Icon, value: condition?.label ?? "Not assessed", detail: trend?.label ?? null, tone: condition?.tone ?? null },
    {
      label: "Water",
      icon: DropletIcon,
      value: water?.label ?? "No schedule",
      detail: row.water_due_on ? waterSuffix(row.water_status, row.water_due_on) : row.last_watered_at ? null : "Never watered",
      tone: water && row.water_status !== "ok" ? water.tone : null,
    },
    {
      label: "Feed",
      icon: FlaskConicalIcon,
      value: feed?.label ?? (plan.length ? "On plan" : "No plan"),
      detail: row.never_fed ? "Never fed" : `${plan.length} in the plan`,
      tone: feed?.tone ?? null,
    },
    {
      label: "Pot",
      icon: FlowerPotIcon,
      value: row.pot_label ?? "No pot",
      detail: [row.pot_diameter_cm && `${row.pot_diameter_cm} cm`, row.repot_due ? "repot due" : row.pot_fit !== "unplanned" && fit.label.toLowerCase(), row.pot_sealed && "no drainage"].filter(Boolean).join(" · ") || null,
      tone: row.repot_due || row.pot_sealed ? "red" : row.pot_fit === "unplanned" ? null : fit.tone,
    },
  ]
}

function Header({ row, onWater, onUpload, pending }: { row: PlantDetail; onWater: () => void; onUpload: ((file: File) => void) | undefined; pending: boolean }) {
  const file = useRef<HTMLInputElement>(null)
  const origin = originLine(row)
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="flex items-center gap-2 text-2xl font-medium tracking-tight">
          <Emblem common={row.common} emoji={row.emoji} />
          {row.name}
        </h1>
        <p className="text-sm text-muted-foreground">
          {row.common ?? "Unidentified"}
          {row.latin ? <i> · {row.latin}</i> : null}
          {row.individuals > 1 ? ` · ${row.individuals} plants` : ""}
          {origin ? ` · ${origin}` : ""}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button size="lg" onClick={onWater} disabled={pending}>
          <Icon icon={DropletIcon} />
          Water
        </Button>
        {onUpload ? (
          <>
            <Button size="lg" variant="secondary" onClick={() => file.current?.click()} disabled={pending}>
              <Icon icon={Camera01Icon} />
              Add photo
            </Button>
            <input
              ref={file}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const picked = e.target.files?.[0]
                e.target.value = ""
                if (picked) onUpload(picked)
              }}
            />
          </>
        ) : null}
      </div>
    </header>
  )
}

function Overview({ row, plan }: { row: PlantDetail; plan: PlanRow[] }) {
  const observed = row.pests.length + row.disorders.length + row.symptoms.length > 0 || row.light_below_need
  return (
    <section className="grid gap-4 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div className="aspect-4/3 overflow-hidden rounded-lg bg-foreground/[0.04] ring-1 ring-foreground/[0.08]">
        {row.cover_url ? (
          <img src={row.cover_url} alt="" className="size-full object-cover" />
        ) : (
          <span className="flex size-full items-center justify-center">
            <Emblem common={row.common} emoji={row.emoji} size="lg" />
          </span>
        )}
      </div>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          {stats(row, plan).map((stat) => (
            <Tile key={stat.label} label={stat.label} icon={stat.icon} value={stat.value} detail={stat.detail} tone={stat.tone} />
          ))}
        </div>
        {observed ? (
          <div className="flex flex-wrap gap-2">
            {row.pests.map((p) => (
              <Chip key={p.pest} tone={p.status === "cleared" ? "green" : "red"} icon={Bug01Icon}>
                {label(p.pest)} · {p.status}
                {p.rounds > 0 ? `, round ${p.rounds}` : ""}
              </Chip>
            ))}
            {row.disorders.map((d) => (
              <Chip key={d} tone="amber">
                {label(d)}
              </Chip>
            ))}
            {row.symptoms.map((s) => (
              <Chip key={s}>{label(s)}</Chip>
            ))}
            {row.light_below_need ? (
              <Chip tone="amber" icon={Sun03Icon}>
                Needs more light
              </Chip>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  )
}

function CareCard({ row, profile }: { row: PlantDetail; profile: Catalog["profiles"][number] | undefined }) {
  return (
    <Card>
      <CardHeader icon={Sun03Icon} title="Care" />
      <CardBody className="flex flex-col gap-4">
        <dl className="grid grid-cols-2 gap-4">
          <Fact label="Location">{row.location ? label(row.location) : "Unknown"}</Fact>
          <Fact label="Phase">{row.phase ? label(row.phase) : "Unknown"}</Fact>
          <Fact label="Light">
            {row.light ? LIGHT[row.light] : "Unknown"}
            {row.light_below_need && row.light_need ? <span className={cn("block text-xs font-normal", TEXT.amber)}>Profile wants {LIGHT[row.light_need].toLowerCase()}</span> : null}
          </Fact>
          <Fact label="Regime">{row.water_regime ? WATER_REGIME[row.water_regime] : "Unknown"}</Fact>
          <Fact label="Interval">{row.water_interval_days ? `Every ${row.water_interval_days} days` : "No schedule"}</Fact>
          <Fact label="Next water">{dueLine(row.water_due_on)}</Fact>
          <Fact label="Last watered">{row.last_watered_at ? fmtTimestamp(row.last_watered_at) : "Never"}</Fact>
          <Fact label="Watch for">{row.pests_watch?.length ? row.pests_watch.map(label).join(", ") : "Nothing specific"}</Fact>
        </dl>
        {profile?.notes ? (
          <div className="border-t pt-4">
            <p className="text-xs text-muted-foreground">{profile.label} profile</p>
            <p className="text-sm">{profile.notes}</p>
          </div>
        ) : null}
      </CardBody>
    </Card>
  )
}

function PotCard({ row, pot, catalog }: { row: PlantDetail; pot: PotRow | undefined; catalog: Catalog }) {
  const substrate = catalog.substrates.find((s) => s.id === row.substrate_id)
  const wanted = catalog.substrates.find((s) => s.id === catalog.profiles.find((p) => p.id === row.profile_id)?.substrate_id)
  const mates = pot?.occupants.filter((o) => o.plant_id !== row.plant_id) ?? []
  const fit = POT_FIT[row.pot_fit]
  return (
    <Card>
      <CardHeader icon={FlowerPotIcon} title="Pot" />
      <CardBody>
        <dl className="grid grid-cols-2 gap-4">
          <Fact label="Pot">
            {row.pot_label ?? "None"}
            {row.pot_label ? (
              <span className="block text-xs font-normal text-muted-foreground">
                {[row.pot_material && label(row.pot_material), row.pot_diameter_cm && `${row.pot_diameter_cm} cm`, pot?.volume_l && `${pot.volume_l} l`].filter(Boolean).join(" · ")}
              </span>
            ) : null}
          </Fact>
          <Fact label="Drainage">
            {row.pot_sealed ? <span className={TEXT.amber}>None</span> : pot?.drainage ? "Yes" : "Unknown"}
            {pot?.saucer ? <span className="block text-xs font-normal text-muted-foreground">With saucer</span> : null}
          </Fact>
          <Fact label="Shares with">
            {mates.length ? (
              <span className="flex flex-wrap gap-x-2">
                {mates.map((m) => (
                  <a key={m.plant_id} href={href.plant(m.plant_id)} className="underline-offset-2 hover:underline">
                    {m.name}
                  </a>
                ))}
              </span>
            ) : (
              "Nobody"
            )}
          </Fact>
          <Fact label="Repot plan">
            {row.repot_target_cm ? `${row.repot_target_cm} cm${row.repot_after ? ` after ${fmtDay(row.repot_after)}` : ""}` : fit.label}
            {row.repot_target_cm ? (
              <span className="flex gap-2 pt-2">
                <Chip tone={fit.tone}>{fit.label}</Chip>
                {row.repot_due ? <Chip tone="red">Due now</Chip> : null}
              </span>
            ) : null}
          </Fact>
          <div className="col-span-2 min-w-0">
            <dt className="text-xs text-muted-foreground">Substrate</dt>
            <dd className="text-sm font-medium">
              {substrate?.label ?? "Unknown mix"}
              {row.substrate_age_days !== null ? <span className="font-normal text-muted-foreground"> · {row.substrate_age_days} days old</span> : null}
              {substrate?.parts.length ? (
                <span className="block text-xs font-normal text-muted-foreground">{substrate.parts.map((p) => [p.percent && `${p.percent}%`, label(p.component)].filter(Boolean).join(" ")).join(", ")}</span>
              ) : null}
              {row.substrate_matches_profile === false && wanted ? <span className={cn("block text-xs font-normal", TEXT.amber)}>Profile wants {wanted.label}</span> : null}
            </dd>
          </div>
        </dl>
      </CardBody>
    </Card>
  )
}

function planMeta(row: PlanRow): string {
  return [
    row.dose_factor === 1 ? "Full dose" : `${Math.round(row.dose_factor * 100)}% dose`,
    row.method && label(row.method),
    row.role !== "feed" && label(row.role),
    row.cadence_days && `every ${row.cadence_days} days`,
    row.season_start && row.season_end && `${monthShort(row.season_start)} to ${monthShort(row.season_end)}`,
  ]
    .filter(Boolean)
    .join(" · ")
}

function NutritionCard({ plan, neverFed }: { plan: PlanRow[]; neverFed: boolean }) {
  return (
    <Card>
      <CardHeader icon={FlaskConicalIcon} title="Nutrition" action={neverFed ? <Chip>Never fed</Chip> : undefined} />
      {plan.length === 0 ? (
        <CardBody className="text-muted-foreground">No feeding programme for this plant.</CardBody>
      ) : (
        <CardList>
          {plan.map((row) => {
            const status = FEED_STATUS[row.status]
            return (
              <CardRow
                key={row.supplement_id}
                title={row.label}
                meta={
                  <>
                    <span className="block">{planMeta(row)}</span>
                    <span className="block">
                      {row.status === "held" && row.hold_until ? `Held until ${fmtDay(row.hold_until)}` : `Next ${row.next_due ? dueLine(row.next_due) : "when needed"}`}
                      {" · "}
                      {row.last_fed ? `Last ${fmtTimestamp(row.last_fed)}` : "Never fed"}
                    </span>
                  </>
                }
                action={<Chip tone={status.tone}>{status.label}</Chip>}
              />
            )
          })}
        </CardList>
      )}
    </Card>
  )
}

function Series({ title, points, format, ...chart }: { title: string; points: Point[]; format: (v: number) => string; domain?: [number, number]; ticks?: number[]; step?: boolean }) {
  const last = points.at(-1)
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <p className="text-xs text-muted-foreground">{title}</p>
      {points.length >= 2 ? (
        <HistoryChart points={points} format={format} {...chart} />
      ) : (
        <p className="text-sm">{last ? `${format(last.value)} on ${fmtDay(last.ts.slice(0, 10))}` : <span className="text-muted-foreground">No readings yet</span>}</p>
      )}
    </div>
  )
}

function HistoryCard({ events }: { events: TypedEvent[] }) {
  const condition = events.flatMap((e) => (e.type === "diagnosis" && e.data.condition ? [{ ts: e.ts, value: conditionIndex(e.data.condition) }] : [])).reverse()
  const height = events.flatMap((e) => (e.type === "measure" && e.data.height_cm !== null ? [{ ts: e.ts, value: e.data.height_cm }] : [])).reverse()
  return (
    <Card>
      <CardHeader icon={Analytics01Icon} title="History" />
      <CardBody className="grid gap-4 sm:grid-cols-2">
        <Series title="Condition" points={condition} format={conditionName} domain={[0, 4]} ticks={[0, 1, 2, 3, 4]} step />
        <Series title="Height" points={height} format={(v) => `${v} cm`} />
      </CardBody>
    </Card>
  )
}

function TasksCard({ tasks, onDone, pending }: { tasks: Task[]; onDone: (id: number) => void; pending: boolean }) {
  return (
    <Card>
      <CardHeader icon={CheckListIcon} title="Open tasks" />
      <CardList>
        {tasks.map((task) => {
          const kind = TASK_KIND[task.kind]
          const due = task.due_on && relDue(task.due_on)
          return (
            <CardRow
              key={task.id}
              icon={kind.icon}
              tone={kind.tone}
              title={task.title}
              meta={`${kind.label}${task.priority === 1 ? " · high priority" : ""}${due ? ` · ${due.tone === "late" ? `${due.label}, ${fmtDay(task.due_on ?? "")}` : due.label}` : ""}`}
              action={
                <Button variant="secondary" icon aria-label={`Mark “${task.title}” done`} disabled={pending} onClick={() => onDone(task.id)}>
                  <Icon icon={Tick02Icon} aria-hidden />
                </Button>
              }
            >
              {task.detail ? <p className="line-clamp-3 text-xs text-muted-foreground whitespace-pre-line">{task.detail}</p> : null}
            </CardRow>
          )
        })}
      </CardList>
    </Card>
  )
}

function Timeline({ events, catalog, pots, coverEventId, pinned, onCover, pending }: { events: TypedEvent[]; catalog: Catalog; pots: PotRow[]; coverEventId: number | null; pinned: boolean; onCover: (eventId: number | null) => void; pending: boolean }) {
  const names = lookups(catalog, pots)
  return (
    <Card>
      <CardHeader icon={Clock01Icon} title="Timeline" />
      {events.length === 0 ? (
        <CardBody className="text-muted-foreground">Nothing logged yet.</CardBody>
      ) : (
        <CardList>
          {events.map((event) => (
            <EventRow key={event.id} event={event} names={names}>
              {event.type === "photo" && event.photo_url ? (
                <div className="flex items-end gap-4 pt-2">
                  <img src={event.photo_url} alt="" loading="lazy" className="h-28 rounded-inset object-cover ring-1 ring-foreground/[0.08]" />
                  {event.id === coverEventId ? (
                    <span className="flex items-center gap-2">
                      <Chip tone="green" icon={PinIcon}>
                        Cover
                      </Chip>
                      {pinned ? (
                        <Button variant="ghost" disabled={pending} onClick={() => onCover(null)}>
                          Unpin
                        </Button>
                      ) : null}
                    </span>
                  ) : (
                    <Button variant="ghost" disabled={pending} onClick={() => onCover(event.id)}>
                      <Icon icon={PinIcon} />
                      Set as cover
                    </Button>
                  )}
                </div>
              ) : null}
            </EventRow>
          ))}
        </CardList>
      )}
    </Card>
  )
}

function Body({ detail, coverEventId, catalog, pots, reload, onUpload }: { detail: PlantDetail; coverEventId: number | null; catalog: Catalog | null; pots: PotRow[] | null; reload: () => void; onUpload: Upload | undefined }) {
  const { run, busy, status } = useMutations(reload)
  const plants = [detail.plant_id]
  const act = (key: string, text: string | null, action: () => Promise<unknown>) => void run(key, () => action().then(() => text))
  const pending = busy.size > 0
  const profile = catalog?.profiles.find((p) => p.id === detail.profile_id)
  const pot = pots?.find((p) => p.pot_id === detail.pot_id)

  return (
    <div className="flex flex-col gap-6">
      <title>{`${detail.name} · leafage`}</title>
      <Header
        row={detail}
        onWater={() => act("water", "Watered", () => core.water({ plants }))}
        onUpload={onUpload && ((file) => act("photo", "Photo added", () => onUpload(detail.plant_id, file)))}
        pending={pending}
      />
      <Overview row={detail} plan={detail.plan} />
      <StatusLine status={status} />
      <div className="grid gap-4 md:grid-cols-2">
        <CareCard row={detail} profile={profile} />
        {catalog ? <PotCard row={detail} pot={pot} catalog={catalog} /> : <Skeleton className="h-48" />}
        <NutritionCard plan={detail.plan} neverFed={detail.never_fed} />
        <HistoryCard events={detail.events} />
      </div>
      {detail.tasks.length > 0 ? <TasksCard tasks={detail.tasks} onDone={(id) => act("task", "Task done", () => core.complete_task({ tasks: id }))} pending={pending} /> : null}
      {catalog && pots ? (
        <Timeline
          events={detail.events}
          catalog={catalog}
          pots={pots}
          coverEventId={coverEventId}
          pinned={detail.cover_is_pinned}
          onCover={(id) => act("cover", null, () => core.update_plant({ plants, patch: { cover_event_id: id } }))}
          pending={pending}
        />
      ) : (
        <Skeleton className="h-64" />
      )}
      {detail.notes ? (
        <Card>
          <CardHeader icon={StickyNote02Icon} title="Notes" />
          <CardBody className="whitespace-pre-line">{detail.notes}</CardBody>
        </Card>
      ) : null}
    </div>
  )
}

type Upload = (plantId: string, file: File) => Promise<void>

export function PlantScreen({ id, onName, onUpload }: { id: string; onName?: (name: string | null) => void; onUpload?: Upload }) {
  const plant = useQuery(async () => {
    const detail = await core.plant({ plant: id, events: 200 })
    const coverEventId = detail.events.find((e) => e.type === "photo" && e.photo_url === detail.cover_url)?.id ?? null
    await Promise.all([signPhotoField([detail], "cover_url"), signPhotoField(detail.events, "photo_url")])
    return { detail, coverEventId }
  }, [id])
  const refs = useQuery(() => Promise.all([core.catalog(), core.pots()]), [])
  const name = plant.data?.detail.name ?? null
  useEffect(() => {
    onName?.(name)
    return () => onName?.(null)
  }, [name, onName])

  if (plant.error instanceof LeafageError && plant.error.code === "not_found") {
    return <EmptyState icon={Leaf01Icon} title="Plant not found" body="It may have been archived or renamed." />
  }
  if (plant.error) return <ErrorState error={plant.error} retry={plant.retry} />
  if (!plant.data) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-4 w-72" />
          </div>
          <Skeleton className="h-11 w-52 rounded-full" />
        </div>
        <div className="grid gap-4 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <Skeleton className="aspect-4/3" />
          <div className="grid grid-cols-2 gap-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        </div>
      </div>
    )
  }
  const [catalog, pots] = refs.data ?? [null, null]
  return <Body detail={plant.data.detail} coverEventId={plant.data.coverEventId} catalog={catalog} pots={pots} reload={plant.retry} onUpload={onUpload} />
}
