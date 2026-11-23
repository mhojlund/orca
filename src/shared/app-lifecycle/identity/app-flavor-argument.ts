import { appFlavorFromId, type AppFlavor } from './app-flavor'

const APP_FLAVOR_ARGUMENT_PREFIX = '--orca-app-flavor='

export function formatAppFlavorArgument(flavor: AppFlavor): string {
  return `${APP_FLAVOR_ARGUMENT_PREFIX}${flavor.id}`
}

/** Read once by the preload: a window's flavor is fixed when it is created. */
export function parseAppFlavorArgument(argv: readonly string[]): AppFlavor | null {
  const id = argv
    .find((arg) => arg.startsWith(APP_FLAVOR_ARGUMENT_PREFIX))
    ?.slice(APP_FLAVOR_ARGUMENT_PREFIX.length)
  return id ? appFlavorFromId(id) : null
}
