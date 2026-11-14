import { cn } from "@/lib/utils"

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("glass relative inline-block rounded-[23%]", className)}>
      <img src="/icon-light.png" alt="" className="size-full dark:hidden" />
      <img src="/icon-dark.png" alt="" className="hidden size-full dark:block" />
    </span>
  )
}
