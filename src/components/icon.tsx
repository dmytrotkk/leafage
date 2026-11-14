import { HugeiconsIcon, type HugeiconsIconProps } from "@hugeicons/react"

export type { IconSvgElement } from "@hugeicons/react"

export function Icon({ strokeWidth = 1.8, ...props }: HugeiconsIconProps) {
  return <HugeiconsIcon strokeWidth={strokeWidth} {...props} />
}
