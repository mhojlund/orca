import type { AppFlavor } from '../../shared/app-lifecycle/identity/app-flavor'

let activeFlavor: AppFlavor | null = null

/** Set once during startup, before userData is chosen; stays null for stock builds, dev runs and headless hosts. */
export function setActiveAppFlavor(flavor: AppFlavor | null): void {
  activeFlavor = flavor
}

export function getActiveAppFlavor(): AppFlavor | null {
  return activeFlavor
}

/** Rebrands user-visible text, including localized strings that embed the product name. */
export function brandForActiveFlavor(text: string): string {
  if (!activeFlavor || text.includes(activeFlavor.displayName)) {
    return text
  }
  return text.replace(/\bOrca\b/g, activeFlavor.displayName)
}
