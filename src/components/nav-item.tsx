import { Icon, type IconSvgElement } from "@/components/icon"
import { cn } from "@/lib/utils"

export function NavItem({
  to,
  active,
  icon,
  label,
  text = false,
  className,
}: {
  to: string
  active: boolean
  icon: IconSvgElement
  label: string
  text?: boolean
  className: string
}) {
  return (
    <a
      href={to}
      title={text ? undefined : label}
      aria-label={text ? undefined : label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "pressable flex items-center justify-center gap-2 rounded-full text-sm font-medium",
        active ? "bg-foreground/[0.08] text-foreground" : "text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground",
        className,
      )}
    >
      <Icon icon={icon} className="size-5" aria-hidden />
      {text ? label : null}
    </a>
  )
}
