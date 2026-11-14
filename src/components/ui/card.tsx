import type { ComponentProps, ReactNode } from "react"

import { Icon, type IconSvgElement } from "@/components/icon"
import { TONE, type Tone } from "@/lib/labels"
import { cn } from "@/lib/utils"

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex flex-col overflow-hidden rounded-lg bg-card text-sm text-card-foreground ring-1 ring-foreground/[0.08]", className)} {...props} />
}

const INSET = "mx-2 mb-2 rounded-inset bg-inset"

export function CardHeader({ icon, title, action }: { icon?: IconSvgElement; title: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-2">
      <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        {icon ? <Icon icon={icon} className="size-3.5" aria-hidden /> : null}
        {title}
      </p>
      {action}
    </div>
  )
}

export function CardBody({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn(INSET, "p-4", className)} {...props} />
}

export function CardMedia({ src, fallback }: { src: string | null; fallback: ReactNode }) {
  return (
    <div className="m-2 aspect-4/3 overflow-hidden rounded-inset bg-foreground/[0.04]">
      {src ? (
        <img src={src} alt="" loading="lazy" className="size-full object-cover transition-[scale] duration-500 ease-out group-hover:scale-[1.02]" />
      ) : (
        <div className="flex size-full items-center justify-center">{fallback}</div>
      )}
    </div>
  )
}

export function CardList({ children }: { children: ReactNode }) {
  return <ul className={cn(INSET, "divide-y divide-foreground/[0.06] overflow-hidden")}>{children}</ul>
}

export function CardRow({
  icon,
  tone = "neutral",
  title,
  meta,
  action,
  children,
}: {
  icon?: IconSvgElement
  tone?: Tone
  title: ReactNode
  meta?: ReactNode
  action?: ReactNode
  children?: ReactNode
}) {
  return (
    <li className="flex items-center gap-4 px-4 py-2">
      {icon ? (
        <span aria-hidden className={cn("flex size-8 shrink-0 items-center justify-center rounded-full", TONE[tone])}>
          <Icon icon={icon} className="size-4" />
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{title}</div>
        {meta ? <div className="text-xs text-muted-foreground">{meta}</div> : null}
        {children}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </li>
  )
}
