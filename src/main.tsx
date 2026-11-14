import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { createCore, createTransport } from "@leafage/core"
import "./index.css"
import App from "./App"
import { AuthGate } from "./components/auth-gate"
import { AuthProvider } from "./lib/auth"
import { setCore } from "./lib/core"
import { supabase } from "./lib/supabase"
import { navigate, parseRoute } from "./router"
import { OAuthConsentScreen } from "./screens/oauth-consent"

setCore(
  createCore(
    createTransport({
      url: import.meta.env.VITE_SUPABASE_URL,
      key: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      token: async () => {
        const { data } = await supabase.auth.getSession()
        const token = data.session?.access_token
        if (!token) throw new Error("Not signed in")
        return token
      },
    }),
  ),
)

addEventListener("hashchange", () => navigate(parseRoute(location.hash)))

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      {location.pathname === "/oauth/consent" ? (
        <AuthGate>
          <OAuthConsentScreen />
        </AuthGate>
      ) : (
        <App />
      )}
    </AuthProvider>
  </StrictMode>,
)
