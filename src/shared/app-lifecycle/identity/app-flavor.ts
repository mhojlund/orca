export type AppFlavor = {
  id: string
  userDataDirName: string
  cliCommandName: string
  linuxCliCommandName: string
  updatesEnabled: boolean
}

const APP_FLAVORS: Readonly<Record<string, AppFlavor>> = {
  rs: {
    id: 'rs',
    userDataDirName: 'orca-rs',
    cliCommandName: 'orca-rs',
    linuxCliCommandName: 'orca-rs-ide',
    updatesEnabled: false
  }
}

/** Flavor builds stamp `orcaFlavor` into package.json; stock and dev builds have none. */
export function appFlavorFromPackageJson(parsed: unknown): AppFlavor | null {
  if (!parsed || typeof parsed !== 'object' || !('orcaFlavor' in parsed)) {
    return null
  }
  const id = parsed.orcaFlavor
  return typeof id === 'string' ? (APP_FLAVORS[id] ?? null) : null
}
