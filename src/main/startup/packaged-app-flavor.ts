import { app } from 'electron'
import type { AppFlavor } from '../../shared/app-lifecycle/identity/app-flavor'
import { readAppFlavorAtAppPath } from './app-flavor-reader'

let cached: { flavor: AppFlavor | null } | null = null

/** Null for dev runs and stock builds; flavor builds carry `orcaFlavor` in the packaged package.json. */
export function getPackagedAppFlavor(): AppFlavor | null {
  if (!app.isPackaged) {
    return null
  }
  cached ??= { flavor: readAppFlavorAtAppPath(app.getAppPath()) }
  return cached.flavor
}
