import type { ReactNode } from "react"

import { AuthScreen } from "@/screens/auth/auth-screen"
import { useAuth } from "@/lib/auth"

export function AuthGate({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()

  if (loading) {
    return <div className="min-h-dvh bg-background" />
  }
  if (!session) return <AuthScreen />
  return <>{children}</>
}
