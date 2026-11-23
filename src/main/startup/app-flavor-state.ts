import type { AppFlavor } from '../../shared/app-lifecycle/identity/app-flavor'
import { formatAppFlavorArgument } from '../../shared/app-lifecycle/identity/app-flavor-argument'
import { setAppBrandName } from '../../shared/app-lifecycle/identity/app-brand'

let activeFlavor: AppFlavor | null = null

/** Set once during startup, before userData is chosen; stays null for stock builds, dev runs and headless hosts. */
export function setActiveAppFlavor(flavor: AppFlavor | null): void {
  activeFlavor = flavor
  setAppBrandName(flavor?.displayName ?? null)
}

export function getActiveAppFlavor(): AppFlavor | null {
  return activeFlavor
}

/** Preload arguments that tell a window's renderer which flavor it runs in. */
export function appFlavorWindowArguments(): string[] {
  return activeFlavor ? [formatAppFlavorArgument(activeFlavor)] : []
}
