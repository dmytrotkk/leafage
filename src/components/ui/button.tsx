import { Button as ButtonPrimitive } from "@base-ui/react/button"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

const VARIANT = {
  primary: "bg-primary text-primary-foreground hover:bg-primary/80",
  secondary: "bg-foreground/[0.06] text-foreground hover:bg-foreground/[0.1]",
  ghost: "text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground",
} as const

const SIZE = {
  lg: "h-11 gap-2 px-4 [&_svg]:size-4.5",
  md: "h-9 gap-2 px-4 [&_svg]:size-4",
} as const

const ICON = { lg: "w-11 px-0", md: "w-9 px-0" } as const

export function Button({
  className,
  variant = "primary",
  size = "md",
  icon = false,
  ...props
}: Omit<ButtonPrimitive.Props, "className"> & {
  className?: string
  variant?: keyof typeof VARIANT
  size?: keyof typeof SIZE
  icon?: boolean
}) {
  const button = (
    <ButtonPrimitive
      className={cn(
        "pressable inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full text-sm font-medium whitespace-nowrap outline-none select-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0",
        SIZE[size],
        icon && ICON[size],
        VARIANT[variant],
        className,
      )}
      {...props}
    />
  )
  const label = props["aria-label"]
  if (!icon || !label) return button
  return (
    <Tooltip>
      <TooltipTrigger render={button} />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
