import { afterEach, describe, expect, it } from 'vitest'
import { setAppBrandName } from '../app-lifecycle/identity/app-brand'
import { parseAppFlavorArgument } from '../app-lifecycle/identity/app-flavor-argument'
import { createOrcaI18n } from './orca-i18n-instance'

describe('flavor branding of translated text', () => {
  afterEach(() => setAppBrandName(null))

  it('rewrites the product name in catalog strings and caller fallbacks, and only for a flavor', () => {
    const { translate } = createOrcaI18n({
      loadCatalog: () => undefined,
      englishResources: { 'menu.about': 'About Orca' }
    })
    expect(translate('menu.about', 'unused')).toBe('About Orca')

    setAppBrandName('Orca RS')
    expect(translate('menu.about', 'unused')).toBe('About Orca RS')
    expect(translate('missing.key', 'Orca is still running in the system tray')).toBe(
      'Orca RS is still running in the system tray'
    )
    expect(translate('missing.key2', 'Orca RS already named')).toBe('Orca RS already named')
  })

  it('reads the flavor a window was created with from its preload arguments', () => {
    expect(parseAppFlavorArgument(['--x', '--orca-app-flavor=rs'])?.displayName).toBe('Orca RS')
    expect(parseAppFlavorArgument(['--orca-app-flavor=nope'])).toBeNull()
    expect(parseAppFlavorArgument([])).toBeNull()
  })
})
