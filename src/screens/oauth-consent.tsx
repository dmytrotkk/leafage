import { useEffect, useState } from "react"
import type { OAuthAuthorizationDetails } from "@supabase/supabase-js"
import {
  Alert02Icon,
  CheckmarkCircle02Icon,
  PlugSocketIcon,
} from "@hugeicons/core-free-icons"

import { Icon } from "@/components/icon"
import { Logo } from "@/components/logo"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { TEXT } from "@/lib/labels"
import { supabase } from "@/lib/supabase"
import { cn } from "@/lib/utils"

const boxClass = "rounded-lg border border-border bg-foreground/[0.02] p-4"

const SCOPE_LABELS: Record<string, string> = {
  openid: "Confirm your identity",
  profile: "See your display name",
  email: "See your email address",
  phone: "See your phone number",
  offline_access: "Stay connected until you revoke access",
}

type ConsentState =
  | { phase: "loading" }
  | { phase: "consent"; details: OAuthAuthorizationDetails }
  | { phase: "redirect" }
  | { phase: "error"; message: string }

function host(uri: string): string | null {
  try {
    return new URL(uri).host
  } catch {
    return null
  }
}

export function OAuthConsentScreen() {
  const authorizationId = new URLSearchParams(location.search).get("authorization_id")
  const [state, setState] = useState<ConsentState>({ phase: "loading" })
  const [deciding, setDeciding] = useState<"approve" | "deny" | null>(null)

  useEffect(() => {
    document.title = "Connect · leafage"
  }, [])

  useEffect(() => {
    if (!authorizationId) {
      setState({
        phase: "error",
        message:
          "This link is missing its authorization request. Start the connection again from your chat app.",
      })
      return
    }
    let active = true
    supabase.auth.oauth.getAuthorizationDetails(authorizationId).then(({ data, error }) => {
      if (!active) return
      if (error) setState({ phase: "error", message: error.message })
      else if ("authorization_id" in data) setState({ phase: "consent", details: data })
      else {
        setState({ phase: "redirect" })
        location.replace(data.redirect_url)
      }
    })
    return () => {
      active = false
    }
  }, [authorizationId])

  async function decide(decision: "approve" | "deny") {
    if (!authorizationId || deciding) return
    setDeciding(decision)
    const { data, error } =
      decision === "approve"
        ? await supabase.auth.oauth.approveAuthorization(authorizationId)
        : await supabase.auth.oauth.denyAuthorization(authorizationId)
    if (error) {
      setState({ phase: "error", message: error.message })
      setDeciding(null)
      return
    }
    location.replace(data.redirect_url)
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <Logo className="mb-4 size-12" />
          {state.phase === "consent" ? (
            <>
              <h1 className="text-2xl font-medium tracking-tight">
                Connect {state.details.client.name}
              </h1>
              <p className="text-sm text-muted-foreground">
                wants access to your garden
              </p>
            </>
          ) : (
            <h1 className="text-2xl font-medium tracking-tight">leafage</h1>
          )}
        </div>

        {state.phase === "loading" && <Skeleton className="h-64" />}

        {state.phase === "redirect" && (
          <p className="text-center text-sm text-muted-foreground">
            Returning to your app…
          </p>
        )}

        {state.phase === "error" && (
          <div className={cn(boxClass, "text-center")}>
            <Icon
              icon={Alert02Icon}
              className={cn("mx-auto mb-2 size-6", TEXT.red)}
              aria-hidden
            />
            <p className="text-sm text-muted-foreground">{state.message}</p>
          </div>
        )}

        {state.phase === "consent" && (
          <>
            <div className={boxClass}>
              <div className="flex items-center gap-4 border-b border-border pb-4">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-foreground/[0.06]">
                  <Icon icon={PlugSocketIcon} className="size-4.5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{state.details.client.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {host(state.details.client.uri) ??
                      host(state.details.redirect_uri) ??
                      "unknown origin"}
                  </p>
                </div>
              </div>
              <ul className="space-y-2 py-4">
                {state.details.scope.split(" ").filter(Boolean).map((scope) => (
                  <li key={scope} className="flex items-start gap-2 text-sm">
                    <Icon
                      icon={CheckmarkCircle02Icon}
                      className="size-4 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                    {SCOPE_LABELS[scope] ?? scope}
                  </li>
                ))}
              </ul>
              <p className="border-t border-border pt-4 text-xs text-muted-foreground">
                Signed in as{" "}
                <span className="font-medium text-foreground">
                  {state.details.user.email}
                </span>
              </p>
            </div>

            <div className="mt-4 flex flex-col gap-2">
              <Button
                type="button"
                size="lg"
                disabled={deciding != null}
                onClick={() => decide("approve")}
                className="w-full"
              >
                {deciding === "approve" ? "Connecting…" : "Approve"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="lg"
                disabled={deciding != null}
                onClick={() => decide("deny")}
                className="w-full"
              >
                Deny
              </Button>
            </div>
            <p className="mt-4 text-center text-xs text-muted-foreground">
              Only approve connections you started yourself.
            </p>
          </>
        )}
      </div>
    </main>
  )
}
