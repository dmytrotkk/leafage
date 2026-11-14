import type { ReactNode } from "react"
import { Popover } from "@base-ui/react/popover"

import { Button } from "@/components/ui/button"
import { popup } from "@/components/ui/popup"
import { cn } from "@/lib/utils"

export function Confirm({
  title,
  body,
  action,
  onConfirm,
  disabled,
  label,
  children,
}: {
  title: string
  body: string
  action: string
  onConfirm: () => void
  disabled: boolean
  label: string
  children: ReactNode
}) {
  return (
    <Popover.Root>
      <Popover.Trigger render={<Button variant="secondary" icon />} disabled={disabled} aria-label={label}>
        {children}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="end" sideOffset={8} collisionPadding={16} className="isolate z-50">
          <Popover.Popup className={cn(popup, "flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2 p-4")}>
            <Popover.Title className="text-base font-medium">{title}</Popover.Title>
            <Popover.Description className="text-sm text-muted-foreground">{body}</Popover.Description>
            <div className="flex justify-end gap-2 pt-2">
              <Popover.Close render={<Button variant="ghost" />}>Cancel</Popover.Close>
              <Popover.Close render={<Button />} onClick={onConfirm}>
                {action}
              </Popover.Close>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
