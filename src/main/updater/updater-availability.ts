import { app } from 'electron'
import { getActiveAppFlavor } from '../startup/app-flavor-state'

/** Flavor builds must never self-update into the stock release feed. */
export function isUpdaterAvailable(): boolean {
  if (!app.isPackaged) {
    return false
  }
  return getActiveAppFlavor()?.updatesEnabled !== false
}
