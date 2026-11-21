import { describe, expect, it } from 'vitest'
import { appFlavorFromPackageJson } from './app-flavor'

describe('appFlavorFromPackageJson', () => {
  it('maps the rs stamp to its profile dir, CLI names and disabled updates', () => {
    expect(appFlavorFromPackageJson({ name: 'orca-rs', orcaFlavor: 'rs' })).toEqual({
      id: 'rs',
      userDataDirName: 'orca-rs',
      cliCommandName: 'orca-rs',
      linuxCliCommandName: 'orca-rs-ide',
      updatesEnabled: false
    })
  })

  it('treats stock, unknown and malformed metadata as no flavor', () => {
    expect(appFlavorFromPackageJson({ name: 'orca' })).toBeNull()
    expect(appFlavorFromPackageJson({ orcaFlavor: 'nope' })).toBeNull()
    expect(appFlavorFromPackageJson({ orcaFlavor: 7 })).toBeNull()
    expect(appFlavorFromPackageJson(null)).toBeNull()
  })
})
