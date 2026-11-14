import { Combobox } from "@base-ui/react/combobox"
import { Tick02Icon } from "@hugeicons/core-free-icons"

import { Icon } from "@/components/icon"
import { popup } from "@/components/ui/popup"
import { cn, inputClass } from "@/lib/utils"

const ZONES = Intl.supportedValuesOf("timeZone")

export function TimezonePicker({ value, onChange }: { value: string; onChange: (zone: string) => void }) {
  return (
    <Combobox.Root items={ZONES} value={value} onValueChange={(next) => next && next !== value && onChange(next)}>
      <Combobox.Input className={inputClass} placeholder="Search a timezone" aria-label="Timezone" />
      <Combobox.Portal>
        <Combobox.Positioner sideOffset={8} className="isolate z-50">
          <Combobox.Popup className={cn(popup, "w-(--anchor-width) max-w-(--available-width) p-2")}>
            <Combobox.Empty className="p-2 text-sm text-muted-foreground">No matching timezone</Combobox.Empty>
            <Combobox.List className="max-h-[min(18rem,var(--available-height))] overflow-y-auto overscroll-contain outline-none">
              {(zone: string) => (
                <Combobox.Item
                  key={zone}
                  value={zone}
                  className="flex h-9 cursor-default items-center justify-between gap-2 rounded-inset px-4 text-sm outline-none select-none data-[highlighted]:bg-foreground/[0.06] data-[selected]:font-medium"
                >
                  <span className="truncate">{zone.replaceAll("_", " ")}</span>
                  <Combobox.ItemIndicator>
                    <Icon icon={Tick02Icon} className="size-4" aria-hidden />
                  </Combobox.ItemIndicator>
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  )
}
