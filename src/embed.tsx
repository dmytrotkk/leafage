import { useEffect } from "react"
import { createRoot } from "react-dom/client"
import { CheckListIcon, Plant02Icon } from "@hugeicons/core-free-icons"
import { useApp, useHostStyles, type App } from "@modelcontextprotocol/ext-apps/react"
import { filterSchema } from "@leafage/core"

import "./embed.css"
import { NavItem } from "@/components/nav-item"
import { TooltipProvider } from "@/components/ui/tooltip"
import { createBridge } from "@/lib/bridge"
import { setCore } from "@/lib/core"
import { href, navigate, parseRoute, useRoute } from "@/router"
import { GardenScreen } from "@/screens/garden"
import { PlantScreen } from "@/screens/plant"
import { TasksScreen } from "@/screens/tasks"

document.addEventListener("click", (event) => {
  const link = event.target instanceof Element ? event.target.closest('a[href^="#/"]') : null
  if (!link) return
  event.preventDefault()
  navigate(parseRoute(link.getAttribute("href") ?? ""))
})

function Shell({ app }: { app: App }) {
  useHostStyles(app, app.getHostContext())
  const route = useRoute()

  useEffect(() => {
    const sync = () => {
      const context = app.getHostContext()
      const root = document.documentElement
      root.classList.toggle("dark", context?.theme === "dark")
      root.toggleAttribute("data-host-styles", Boolean(context?.styles?.variables))
      for (const side of ["top", "right", "bottom", "left"] as const) root.style.setProperty(`--safe-${side}`, `${context?.safeAreaInsets?.[side] ?? 0}px`)
    }
    sync()
    app.addEventListener("hostcontextchanged", sync)
    return () => app.removeEventListener("hostcontextchanged", sync)
  }, [app])

  return (
    <TooltipProvider>
      <main className="flex flex-col gap-4">
        <nav className="flex gap-2">
          <NavItem to={href.garden} active={route.screen === "garden"} icon={Plant02Icon} label="Garden" text className="h-11 px-4" />
          <NavItem to={href.tasks} active={route.screen === "tasks"} icon={CheckListIcon} label="Tasks" text className="h-11 px-4" />
        </nav>
        {route.screen === "garden" ? <GardenScreen key={JSON.stringify(route.filter ?? {})} filter={route.filter} /> : null}
        {route.screen === "plant" ? <PlantScreen key={route.id} id={route.id} /> : null}
        {route.screen === "tasks" ? <TasksScreen /> : null}
      </main>
    </TooltipProvider>
  )
}

function Embed() {
  const { app, error } = useApp({
    appInfo: { name: "leafage", version: __APP_VERSION__ },
    capabilities: { availableDisplayModes: ["fullscreen"] },
    onAppCreated: (created) => {
      setCore(createBridge(created))
      created.addEventListener("toolinput", (input) => {
        const filter = filterSchema.safeParse(input.arguments ?? {})
        if (filter.success) navigate({ screen: "garden", filter: filter.data }, false)
      })
    },
  })
  if (error) return <p className="p-4 text-sm text-muted-foreground">{error.message}</p>
  return app ? <Shell app={app} /> : null
}

createRoot(document.getElementById("root")!).render(<Embed />)
