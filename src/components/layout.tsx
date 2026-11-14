import { useEffect, useState, type ReactNode } from "react"
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  CheckListIcon,
  Plant02Icon,
} from "@hugeicons/core-free-icons"

import { BottomNav } from "@/components/bottom-nav"
import { Icon } from "@/components/icon"
import { Logo } from "@/components/logo"
import { NavItem } from "@/components/nav-item"
import { ProfileMenu } from "@/components/profile-menu"
import { cn } from "@/lib/utils"
import { href, type Route } from "@/router"

function ShellHeader({ route, crumb }: { route: Route; crumb: string | null }) {
  const onPlant = route.screen === "plant"
  const [lastCrumb, setLastCrumb] = useState(crumb)
  if (crumb && crumb !== lastCrumb) setLastCrumb(crumb)

  const show = onPlant && crumb !== null
  const [open, setOpen] = useState(show)
  useEffect(() => {
    if (show === open) return
    const id = setTimeout(() => setOpen(show), 220)
    return () => clearTimeout(id)
  }, [show, open])
  const sectionIcon = route.screen === "tasks" ? CheckListIcon : Plant02Icon
  return (
    <header className="glass absolute top-2 left-2 z-10 hidden h-11 w-fit max-w-[calc(100%-1rem)] items-center rounded-inset pr-4 text-sm [view-transition-name:shell-header] md:flex">
      <a
        href={route.screen === "tasks" ? href.tasks : href.garden}
        aria-current={onPlant ? undefined : "page"}
        className={cn(
          "pressable flex h-full items-center gap-2 rounded-l-inset pl-4",
          onPlant ? "text-muted-foreground hover:text-foreground" : "font-medium",
        )}
      >
        <Icon icon={sectionIcon} className="size-4 text-muted-foreground" aria-hidden />
        {route.screen === "tasks" ? "Tasks" : "Garden"}
      </a>
      <span
        aria-hidden={!onPlant}
        className={cn(
          "flex min-w-0 items-center gap-2 overflow-hidden whitespace-nowrap",
          "motion-safe:transition-[max-width,opacity,margin-left] motion-safe:duration-150 motion-safe:ease-out",
          open ? "ml-2 max-w-36 opacity-100" : "ml-0 max-w-0 opacity-0",
        )}
      >
        <Icon
          icon={ArrowRight01Icon}
          className="size-3.5 shrink-0 text-muted-foreground"
          aria-hidden
        />
        <span className="truncate font-medium">{onPlant ? crumb : lastCrumb}</span>
      </span>
    </header>
  )
}

function BackPill() {
  return (
    <a
      href={href.garden}
      aria-label="Back to garden"
      className="pressable glass fixed top-[calc(env(safe-area-inset-top)_+_0.5rem)] left-4 z-20 flex size-11 items-center justify-center rounded-full [view-transition-name:back-pill] md:hidden"
    >
      <Icon icon={ArrowLeft01Icon} className="size-5" aria-hidden />
    </a>
  )
}

export function Layout({
  route,
  crumb,
  children,
}: {
  route: Route
  crumb: string | null
  children: ReactNode
}) {
  const onGarden = route.screen === "garden" || route.screen === "plant"
  return (
    <div className="flex md:h-dvh pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)]">
      <aside
        aria-label="Primary"
        className="hidden h-full w-16 shrink-0 flex-col items-center gap-2 py-4 [view-transition-name:rail] md:flex"
      >
        <a
          href={href.garden}
          title="leafage"
          className="pressable mb-2 flex size-10 items-center justify-center"
        >
          <Logo className="size-7" />
        </a>
        <NavItem to={href.garden} active={onGarden} icon={Plant02Icon} label="Garden" className="size-10" />
        <NavItem to={href.tasks} active={route.screen === "tasks"} icon={CheckListIcon} label="Tasks" className="size-10" />
        <div className="mt-auto">
          <ProfileMenu active={route.screen === "account"} />
        </div>
      </aside>

      <div className="min-w-0 flex-1 md:py-2 md:pr-2">
        <div className="relative bg-shell max-md:min-h-dvh md:h-full md:overflow-hidden md:rounded-lg md:ring-1 md:ring-foreground/[0.06]">
          <ShellHeader route={route} crumb={crumb} />
          {route.screen === "plant" ? <BackPill /> : null}
          <div
            id="app-scroll"
            className="md:h-full md:overflow-y-auto md:overscroll-y-contain md:[scrollbar-gutter:stable_both-edges]"
          >
            <main
              className={cn(
                "mx-auto w-full max-w-5xl px-4 sm:px-6 md:pt-[4.75rem] md:pb-6",
                "max-md:pb-[calc(env(safe-area-inset-bottom)_+_7rem)]",
                route.screen === "plant"
                  ? "max-md:pt-[calc(env(safe-area-inset-top)_+_5rem)]"
                  : "max-md:pt-[calc(env(safe-area-inset-top)_+_3rem)]",
              )}
            >
              {children}
            </main>
          </div>
        </div>
      </div>

      <BottomNav active={route.screen} />
    </div>
  )
}
