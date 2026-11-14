import type { ReactNode } from "react"

import type { IconSvgElement } from "@/components/icon"
import { Card, CardBody, CardHeader } from "@/components/ui/card"
import { TEXT, type Tone } from "@/lib/labels"
import { cn } from "@/lib/utils"

export function Tile({
  label,
  icon,
  value,
  detail,
  tone,
  children,
}: {
  label: string
  icon: IconSvgElement
  value: string | number
  detail?: string | null
  tone?: Tone | null
  children?: ReactNode
}) {
  return (
    <Card>
      <CardHeader icon={icon} title={label} />
      <CardBody className="flex flex-1 flex-col gap-4">
        <div className="min-w-0">
          <p className={cn("truncate text-2xl font-medium tracking-tight tabular-nums", tone && TEXT[tone])}>{value}</p>
          {detail ? <p className="truncate text-xs text-muted-foreground">{detail}</p> : null}
        </div>
        {children}
      </CardBody>
    </Card>
  )
}
