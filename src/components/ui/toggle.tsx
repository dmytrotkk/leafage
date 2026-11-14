import type { ComponentProps } from "react"

import { cn } from "@/lib/utils"

export function Toggle({ pressed, className, ...props }: ComponentProps<"button"> & { pressed: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={cn(
        "pressable flex h-9 cursor-pointer items-center gap-2 rounded-full px-4 text-sm font-medium whitespace-nowrap ring-1 ring-foreground/[0.06] [&_svg]:size-4 [&_svg]:shrink-0",
        pressed ? "bg-foreground/[0.1] text-foreground" : "bg-foreground/[0.04] text-muted-foreground hover:text-foreground",
        className,
      )}
      {...props}
    />
  )
}
