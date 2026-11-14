import { useState } from "react"
import { AiChat02Icon, Copy01Icon, Tick02Icon, UserAccountIcon } from "@hugeicons/core-free-icons"
import type { ProfilePatch } from "@leafage/core"

import { ErrorState, StatusLine } from "@/components/data-state"
import { Icon } from "@/components/icon"
import { TimezonePicker } from "@/components/timezone-picker"
import { Button } from "@/components/ui/button"
import { Card, CardBody, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useMutations } from "@/hooks/use-mutations"
import { useQuery } from "@/hooks/use-query"
import { useAuth } from "@/lib/auth"
import { core } from "@/lib/core"
import { supabase } from "@/lib/supabase"
import { cn, inputClass } from "@/lib/utils"

const MCP_URL = "https://app.leafage.garden/mcp"

function localTime(zone: string): string | null {
  try {
    return new Intl.DateTimeFormat("en", { timeZone: zone, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date())
  } catch {
    return null
  }
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      variant="ghost"
      aria-label="Copy address"
      onClick={() => {
        void navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
    >
      <Icon icon={copied ? Tick02Icon : Copy01Icon} />
      {copied ? "Copied" : "Copy"}
    </Button>
  )
}

export function AccountScreen() {
  const { session } = useAuth()
  const { data: profile, error, retry } = useQuery(() => core.profile(), [])
  const [draft, setDraft] = useState<string | null>(null)
  const { run, busy, status } = useMutations(retry)
  const pending = busy.size > 0
  const save = (patch: ProfilePatch) =>
    void run("save", async () => {
      await core.update_profile(patch)
      setDraft(null)
      return "Saved"
    })

  if (error) return <ErrorState error={error} retry={retry} />

  const name = draft ?? profile?.display_name ?? ""
  const commitName = () => {
    const next = name.trim()
    if (profile && next && next !== profile.display_name) save({ display_name: next })
    else setDraft(null)
  }
  const now = profile ? localTime(profile.timezone) : null

  return (
    <div className="flex flex-col gap-6">
      <title>Account · leafage</title>
      <header>
        <h1 className="text-2xl font-medium tracking-tight">Account</h1>
        <p className="text-sm text-muted-foreground">{session?.user.email}</p>
      </header>

      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader icon={UserAccountIcon} title="Profile" action={<StatusLine status={draft === null || status?.error ? status : null} />} />
          <CardBody className="flex flex-col gap-4">
            {!profile ? (
              <>
                <Skeleton className="h-11" />
                <Skeleton className="h-11" />
              </>
            ) : (
              <>
                <label className="flex flex-col gap-2">
                  <span className="text-xs text-muted-foreground">Display name</span>
                  <input
                    className={inputClass}
                    value={name}
                    disabled={pending}
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={commitName}
                    onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                  />
                </label>
                <div className="flex flex-col gap-2">
                  <span className="text-xs text-muted-foreground">Timezone</span>
                  <TimezonePicker value={profile.timezone} onChange={(timezone) => save({ timezone })} />
                  <p className={cn("text-xs text-muted-foreground", pending && "opacity-50")}>
                    Due dates are computed in this timezone.{now ? ` It is ${now} there now.` : ""}
                  </p>
                </div>
              </>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader icon={AiChat02Icon} title="Connect your assistant" />
          <CardBody className="flex flex-col gap-4">
            <p>Leafage is also a server your assistant can talk to. Add it to Claude as a custom connector and it can read the garden, log care and plan the week with you.</p>
            <div className="flex items-center gap-2 rounded-inset bg-foreground/[0.04] py-2 pr-2 pl-4">
              <code className="min-w-0 flex-1 truncate text-xs">{MCP_URL}</code>
              <CopyButton text={MCP_URL} />
            </div>
            <ol className="list-decimal space-y-2 pl-4 text-muted-foreground">
              <li>In Claude, open Settings, then Connectors.</li>
              <li>Choose Add custom connector and paste the address above.</li>
              <li>Sign in with the same Google account you use here.</li>
            </ol>
          </CardBody>
        </Card>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <Button variant="secondary" onClick={() => void supabase.auth.signOut()}>
          Sign out
        </Button>
        <span className="tabular-nums">leafage v{__APP_VERSION__}</span>
      </div>
    </div>
  )
}
