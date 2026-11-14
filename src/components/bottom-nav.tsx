import {
  CheckListIcon,
  Plant02Icon,
  UserCircleIcon,
} from "@hugeicons/core-free-icons"

import { NavItem } from "@/components/nav-item"
import { SignOutButton } from "@/components/sign-out-button"
import { ThemeToggle } from "@/components/theme-toggle"
import { useScrollCompact } from "@/hooks/use-scroll-compact"
import { cn } from "@/lib/utils"
import { href, type Route } from "@/router"

export function BottomNav({ active }: { active: Route["screen"] }) {
  const compact = useScrollCompact()
  const recede = cn(
    "transition-[translate,scale] duration-300 ease-out",
    compact && "translate-y-2 scale-[0.86]",
  )
  const gardenActive = active === "garden" || active === "plant"
  return (
    <nav
      aria-label="Primary"
      className="pointer-events-none fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 flex items-center justify-center gap-2 px-4 md:hidden"
    >
      <div
        className={cn(
          "glass pointer-events-auto relative flex items-center gap-2 rounded-full p-2 [view-transition-name:bottom-nav]",
          recede,
        )}
      >
        <NavItem to={href.garden} active={gardenActive} icon={Plant02Icon} label="Garden" text className="h-9 px-4" />
        <NavItem to={href.tasks} active={active === "tasks"} icon={CheckListIcon} label="Tasks" text className="h-9 px-4" />
      </div>

      <div
        className={cn(
          "glass pointer-events-auto relative flex items-center gap-2 rounded-full p-2 [view-transition-name:bottom-nav-toggle]",
          recede,
        )}
      >
        <NavItem to={href.account} active={active === "account"} icon={UserCircleIcon} label="Account" className="size-9" />
        <ThemeToggle className="size-9 rounded-full text-muted-foreground" />
        <SignOutButton className="size-9 rounded-full text-muted-foreground" />
      </div>
    </nav>
  )
}
