import { Menu } from "@base-ui/react/menu"
import { Logout03Icon, Moon02Icon, Sun03Icon, UserAccountIcon, UserCircleIcon } from "@hugeicons/core-free-icons"

import { Icon, type IconSvgElement } from "@/components/icon"
import { popup } from "@/components/ui/popup"
import { useQuery } from "@/hooks/use-query"
import { useAuth } from "@/lib/auth"
import { core } from "@/lib/core"
import { supabase } from "@/lib/supabase"
import { setDark, useTheme } from "@/lib/theme"
import { cn } from "@/lib/utils"
import { href } from "@/router"

const rowClass = "pressable flex h-9 cursor-pointer items-center gap-2 rounded-inset px-2 text-sm outline-none select-none data-[highlighted]:bg-foreground/[0.06]"

function ThemeOption({ value, icon, label }: { value: string; icon: IconSvgElement; label: string }) {
  return (
    <Menu.RadioItem
      value={value}
      className="pressable flex h-9 flex-1 cursor-pointer items-center justify-center gap-2 rounded-full text-sm font-medium text-muted-foreground ring-1 ring-foreground/[0.06] outline-none select-none data-[checked]:bg-foreground/[0.1] data-[checked]:text-foreground data-[highlighted]:text-foreground"
    >
      <Icon icon={icon} className="size-4" aria-hidden />
      {label}
    </Menu.RadioItem>
  )
}

function ThemeSwitcher() {
  const dark = useTheme()
  return (
    <Menu.RadioGroup aria-label="Theme" value={dark ? "dark" : "light"} onValueChange={(value: string) => setDark(value === "dark")} className="flex gap-2">
      <ThemeOption value="light" icon={Sun03Icon} label="Light" />
      <ThemeOption value="dark" icon={Moon02Icon} label="Dark" />
    </Menu.RadioGroup>
  )
}

export function ProfileMenu({ active }: { active: boolean }) {
  const { session } = useAuth()
  const uid = session?.user.id
  const email = session?.user.email ?? ""
  const { data: profile } = useQuery(() => core.profile(), [uid])
  const name = profile?.display_name || email.split("@")[0] || "Gardener"

  return (
    <Menu.Root>
      <Menu.Trigger
        title="Profile"
        aria-label="Profile"
        className={cn(
          "pressable flex size-10 cursor-pointer items-center justify-center rounded-full",
          active ? "bg-foreground/[0.08] text-foreground" : "text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground data-[popup-open]:bg-foreground/[0.06] data-[popup-open]:text-foreground",
        )}
      >
        <Icon icon={UserCircleIcon} className="size-5" aria-hidden />
      </Menu.Trigger>

      <Menu.Portal>
        <Menu.Positioner side="right" align="end" sideOffset={8} collisionPadding={16} className="isolate z-50">
          <Menu.Popup className={cn(popup, "w-64 p-2")}>
            <div className="flex items-center gap-2 p-2">
              <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full bg-foreground/[0.06] text-sm font-medium uppercase">
                {name.slice(0, 1)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{name}</p>
                <p className="truncate text-xs text-muted-foreground">{email}</p>
              </div>
            </div>

            <Menu.Separator className="-mx-2 my-2 h-px bg-foreground/[0.08]" />

            <ThemeSwitcher />

            <Menu.Separator className="-mx-2 my-2 h-px bg-foreground/[0.08]" />

            <Menu.LinkItem href={href.account} closeOnClick className={rowClass}>
              <Icon icon={UserAccountIcon} className="size-4" aria-hidden />
              Account
            </Menu.LinkItem>
            <Menu.Item onClick={() => void supabase.auth.signOut()} className={rowClass}>
              <Icon icon={Logout03Icon} className="size-4" aria-hidden />
              Sign out
            </Menu.Item>

            <Menu.Separator className="-mx-2 my-2 h-px bg-foreground/[0.08]" />

            <div className="flex items-center justify-between px-2 text-xs text-muted-foreground">
              <span className="font-medium">leafage</span>
              <span className="tabular-nums">v{__APP_VERSION__}</span>
            </div>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}
