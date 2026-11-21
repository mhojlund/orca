import { app } from 'electron'
import { getPackagedAppFlavor } from '../startup/packaged-app-flavor'

/** Flavor builds must never self-update into the stock release feed. */
export function isUpdaterAvailable(): boolean {
  if (!app.isPackaged) {
    return false
  }
  return getPackagedAppFlavor()?.updatesEnabled !== false
}
