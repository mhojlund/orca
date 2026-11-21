import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  appFlavorFromPackageJson,
  type AppFlavor
} from '../../shared/app-lifecycle/identity/app-flavor'

/** Electron-free so headless hosts and the CLI installer can share it; null for stock builds. */
export function readAppFlavorAtAppPath(appPath: string): AppFlavor | null {
  try {
    return appFlavorFromPackageJson(JSON.parse(readFileSync(join(appPath, 'package.json'), 'utf8')))
  } catch {
    return null
  }
}
