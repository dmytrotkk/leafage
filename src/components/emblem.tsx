import { Leaf01Icon } from "@hugeicons/core-free-icons"

import { Icon } from "@/components/icon"
import { cn } from "@/lib/utils"

const ART = import.meta.glob<string>("../assets/plants/*.png", { eager: true, import: "default" })

const SIZE = {
  sm: { image: "size-6", emoji: "text-base" },
  lg: { image: "size-24", emoji: "text-2xl" },
} as const

export function Emblem({ common, emoji, size = "sm" }: { common: string | null; emoji: string | null; size?: keyof typeof SIZE }) {
  const src = common ? ART[`../assets/plants/${common.toLowerCase().replaceAll(" ", "-")}.png`] : undefined
  if (src) return <img src={src} alt="" className={cn("shrink-0 object-contain", SIZE[size].image)} />
  if (emoji) {
    return (
      <span aria-hidden className={cn("shrink-0 leading-none", SIZE[size].emoji)}>
        {emoji}
      </span>
    )
  }
  return <Icon icon={Leaf01Icon} className={cn("shrink-0 text-muted-foreground", SIZE[size].image)} aria-hidden />
}
