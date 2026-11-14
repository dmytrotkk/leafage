import { useState } from "react"

import { AuthGate } from "@/components/auth-gate"
import { Layout } from "@/components/layout"
import { TooltipProvider } from "@/components/ui/tooltip"
import { uploadPlantPhoto } from "@/lib/upload"
import { useRoute } from "@/router"
import { AccountScreen } from "@/screens/account"
import { GardenScreen } from "@/screens/garden"
import { PlantScreen } from "@/screens/plant"
import { TasksScreen } from "@/screens/tasks"

export default function App() {
  const route = useRoute()
  const [crumb, setCrumb] = useState<string | null>(null)
  return (
    <AuthGate>
      <TooltipProvider>
        <Layout route={route} crumb={crumb}>
          {route.screen === "garden" ? <GardenScreen /> : null}
          {route.screen === "plant" ? <PlantScreen key={route.id} id={route.id} onName={setCrumb} onUpload={uploadPlantPhoto} /> : null}
          {route.screen === "tasks" ? <TasksScreen /> : null}
          {route.screen === "account" ? <AccountScreen /> : null}
        </Layout>
      </TooltipProvider>
    </AuthGate>
  )
}
