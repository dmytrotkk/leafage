import { Moon02Icon, Sun03Icon } from "@hugeicons/core-free-icons"

import { Icon } from "@/components/icon"
import { setDark, useTheme } from "@/lib/theme"
import { cn } from "@/lib/utils"

export function ThemeToggle({ className }: { className?: string }) {
  const dark = useTheme()
  return (
    <button
      type="button"
      onClick={() => setDark(!dark)}
      title={dark ? "Switch to light theme" : "Switch to dark theme"}
      aria-label="Toggle theme"
      className={cn(
        "pressable flex cursor-pointer items-center justify-center",
        className,
      )}
    >
      <Icon icon={dark ? Sun03Icon : Moon02Icon} className="size-5" aria-hidden />
    </button>
  )
}
