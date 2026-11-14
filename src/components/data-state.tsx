import { AlertCircleIcon, RefreshIcon } from "@hugeicons/core-free-icons"

import { Icon, type IconSvgElement } from "@/components/icon"
import { Button } from "@/components/ui/button"
import { failure, type Status } from "@/hooks/use-mutations"
import { TEXT } from "@/lib/labels"
import { cn } from "@/lib/utils"

export function ErrorState({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-6 text-center">
      <Icon icon={AlertCircleIcon} className={cn("size-6", TEXT.red)} aria-hidden />
      <p className="text-base font-medium">Couldn’t load</p>
      <p className="max-w-sm text-sm text-muted-foreground">{failure(error)}</p>
      <Button variant="secondary" className="mt-2" onClick={retry}>
        <Icon icon={RefreshIcon} />
        Try again
      </Button>
    </div>
  )
}

const EMPTY = {
  sm: { box: "size-11 rounded-full", icon: "size-5", title: "text-sm", body: "text-xs" },
  lg: { box: "mb-2 size-16 rounded-lg", icon: "size-8", title: "text-2xl tracking-tight", body: "max-w-sm text-sm" },
} as const

export function EmptyState({ icon, title, body, size = "lg" }: { icon: IconSvgElement; title: string; body: string; size?: keyof typeof EMPTY }) {
  const sized = EMPTY[size]
  return (
    <div className="flex flex-col items-center gap-2 py-6 text-center">
      <div className={cn("flex items-center justify-center bg-foreground/[0.05] text-muted-foreground", sized.box)}>
        <Icon icon={icon} className={sized.icon} aria-hidden />
      </div>
      <h3 className={cn("font-medium", sized.title)}>{title}</h3>
      <p className={cn("text-muted-foreground", sized.body)}>{body}</p>
    </div>
  )
}

export function StatusLine({ status }: { status: Status | null }) {
  if (!status) return null
  return (
    <p className={cn("text-sm", status.error ? TEXT.red : "text-muted-foreground")} role={status.error ? "alert" : "status"}>
      {status.text}
    </p>
  )
}
