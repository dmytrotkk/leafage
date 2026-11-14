import type { ReactNode } from "react"
import type { Catalog, TypedEvent } from "@leafage/core"

import { CardRow } from "@/components/ui/card"
import { fmtTimestamp } from "@/lib/format"
import { EVENT, label } from "@/lib/labels"

interface Names {
  pot: (id: string | null) => string
  substrate: (id: string | null) => string
  supplement: (id: string) => string
}

export function lookups(catalog: Catalog, pots: { pot_id: string; label: string }[]): Names {
  const potNames = new Map(pots.map((p) => [p.pot_id, p.label]))
  const substrates = new Map(catalog.substrates.map((s) => [s.id, s.label]))
  const supplements = new Map(catalog.supplements.map((s) => [s.id, s.label]))
  return {
    pot: (id) => (id && potNames.get(id)) || "a pot",
    substrate: (id) => (id && substrates.get(id)) || "unknown mix",
    supplement: (id) => supplements.get(id) ?? id,
  }
}

function describe(event: TypedEvent, names: Names): string {
  switch (event.type) {
    case "watering":
      return [label(event.data.method), event.data.ml && `${event.data.ml} ml`].filter(Boolean).join(" · ")
    case "feed":
      return [
        names.supplement(event.data.supplement_id),
        event.data.dose_factor !== 1 && `${Math.round(event.data.dose_factor * 100)}% dose`,
        event.data.method && label(event.data.method),
      ]
        .filter(Boolean)
        .join(" · ")
    case "treatment":
      return [label(event.data.pest), event.data.agent].filter(Boolean).join(" · ")
    case "repot":
      return [
        `into ${names.pot(event.data.to_pot_id)}`,
        event.data.substrate_id && names.substrate(event.data.substrate_id),
        event.data.roots !== "unknown" && `roots ${event.data.roots}`,
        event.data.root_pruned && "roots pruned",
      ]
        .filter(Boolean)
        .join(" · ")
    case "prune":
      return label(event.data.part)
    case "measure":
      return [
        event.data.height_cm && `${event.data.height_cm} cm tall`,
        event.data.canopy_cm && `${event.data.canopy_cm} cm canopy`,
        event.data.trunk_mm && `${event.data.trunk_mm} mm trunk`,
      ]
        .filter(Boolean)
        .join(" · ")
    case "diagnosis":
      return [
        event.data.condition && label(event.data.condition),
        event.data.phase && label(event.data.phase),
        event.data.symptoms?.length && event.data.symptoms.map(label).join(", "),
        event.data.disorders?.length && event.data.disorders.map(label).join(", "),
        event.data.pests?.length && event.data.pests.map((p) => `${label(p.pest)} ${p.status}`).join(", "),
        event.data.pests?.length === 0 && "cleared",
      ]
        .filter(Boolean)
        .join(" · ")
    case "move":
      return [event.data.location && label(event.data.location), event.data.light && label(event.data.light)]
        .filter(Boolean)
        .join(" · ")
    case "photo":
      return event.data?.shot ? label(event.data.shot) : ""
    case "note":
      return ""
  }
}

export function EventRow({ event, names, children }: { event: TypedEvent; names: Names; children?: ReactNode }) {
  const meta = EVENT[event.type]
  const detail = describe(event, names)
  return (
    <CardRow
      icon={meta.icon}
      tone={meta.tone}
      title={
        <span className="flex flex-wrap items-baseline gap-2">
          {meta.label}
          <span className="text-xs font-normal text-muted-foreground">{fmtTimestamp(event.ts)}</span>
        </span>
      }
      meta={detail || undefined}
    >
      {event.note ? <p className="text-sm whitespace-pre-line">{event.note}</p> : null}
      {children}
    </CardRow>
  )
}
