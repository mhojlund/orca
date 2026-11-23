import { afterEach, describe, expect, it } from 'vitest'
import { appFlavorFromPackageJson } from '../../shared/app-lifecycle/identity/app-flavor'
import { setActiveAppFlavor } from '../startup/app-flavor-state'
import { brandMenuTemplate } from './app-flavor-menu-branding'

const template: Electron.MenuItemConstructorOptions[] = [
  {
    label: 'Orca',
    submenu: [
      { label: 'About Orca' },
      { label: 'Über Orca' },
      {
        label: 'Quit Completely...',
        toolTip: 'Plain Quit keeps agents running so Orca reattaches.'
      },
      { role: 'services' }
    ]
  }
]

describe('brandMenuTemplate', () => {
  afterEach(() => setActiveAppFlavor(null))

  it('renames Orca in labels and tooltips at every depth for a flavor build', () => {
    setActiveAppFlavor(appFlavorFromPackageJson({ orcaFlavor: 'rs' }))
    expect(brandMenuTemplate(template)).toEqual([
      {
        label: 'Orca RS',
        submenu: [
          { label: 'About Orca RS' },
          { label: 'Über Orca RS' },
          {
            label: 'Quit Completely...',
            toolTip: 'Plain Quit keeps agents running so Orca RS reattaches.'
          },
          { role: 'services' }
        ]
      }
    ])
  })

  it('leaves stock menus untouched', () => {
    expect(brandMenuTemplate(template)).toBe(template)
  })
})
