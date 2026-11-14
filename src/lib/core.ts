import type { Core } from "@leafage/core"

export let core: Core

export function setCore(next: Core): void {
  core = next
}
