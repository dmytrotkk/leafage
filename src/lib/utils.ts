import { extendTailwindMerge } from "tailwind-merge"

export const cn = extendTailwindMerge({ extend: { theme: { radius: ["inset"] } } })

export const inputClass =
  "h-11 w-full rounded-lg border border-border bg-foreground/[0.02] px-4 text-sm text-foreground outline-none transition-[color,box-shadow,border-color] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring dark:bg-input/30"
