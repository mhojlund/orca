import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  appFlavorFromPackageJson,
  type AppFlavor
} from '../shared/app-lifecycle/identity/app-flavor'

// Node-mode CLI code cannot read app.asar, so the build stamps the flavor into the unpacked out/package.json.
export function readCliAppFlavor(runtimeDir = __dirname): AppFlavor | null {
  try {
    return appFlavorFromPackageJson(
      JSON.parse(readFileSync(join(runtimeDir, '..', 'package.json'), 'utf8'))
    )
  } catch {
    return null
  }
}
