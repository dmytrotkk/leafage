import type { ReactNode } from "react"

import { Icon, type IconSvgElement } from "@/components/icon"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { TONE, type Tone } from "@/lib/labels"
import { cn } from "@/lib/utils"

export const chip = "inline-flex h-7 min-w-0 items-center gap-2 rounded-full px-2 text-xs font-medium whitespace-nowrap"

export function Chip({
  tone = "neutral",
  icon,
  title,
  className,
  children,
}: {
  tone?: Tone
  icon?: IconSvgElement
  title?: string
  className?: string
  children?: ReactNode
}) {
  if (children === undefined) {
    return (
      <Tooltip>
        <TooltipTrigger render={<span className={cn(chip, "w-7 shrink-0 justify-center px-0", TONE[tone], className)} aria-label={title} />}>
          {icon ? <Icon icon={icon} className="size-3.5 shrink-0" aria-hidden /> : null}
        </TooltipTrigger>
        <TooltipContent>{title}</TooltipContent>
      </Tooltip>
    )
  }
  return (
    <span title={title} className={cn(chip, TONE[tone], className)}>
      {icon ? <Icon icon={icon} className="size-3.5 shrink-0" aria-hidden /> : null}
      <span className="min-w-0 truncate">{children}</span>
    </span>
  )
}
