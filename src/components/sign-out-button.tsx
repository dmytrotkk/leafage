import { useState } from "react"
import { Logout03Icon } from "@hugeicons/core-free-icons"

import { Icon } from "@/components/icon"
import { supabase } from "@/lib/supabase"
import { cn } from "@/lib/utils"

export function SignOutButton({ className }: { className?: string }) {
  const [pending, setPending] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        setPending(true)
        const { error } = await supabase.auth.signOut()
        if (error) setPending(false)
      }}
      disabled={pending}
      title="Sign out"
      aria-label="Sign out"
      className={cn(
        "pressable flex cursor-pointer items-center justify-center disabled:opacity-50",
        className,
      )}
    >
      <Icon icon={Logout03Icon} className="size-5" aria-hidden />
    </button>
  )
}
