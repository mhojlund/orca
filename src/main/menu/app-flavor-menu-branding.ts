import { brandForActiveFlavor, getActiveAppFlavor } from '../startup/app-flavor-state'

type MenuTemplate = Electron.MenuItemConstructorOptions[]

/** Applied to the finished template so every localized label and tooltip carries the flavor's name. */
export function brandMenuTemplate(items: MenuTemplate): MenuTemplate {
  if (!getActiveAppFlavor()) {
    return items
  }
  return items.map((item) => ({
    ...item,
    ...(item.label ? { label: brandForActiveFlavor(item.label) } : {}),
    ...(item.toolTip ? { toolTip: brandForActiveFlavor(item.toolTip) } : {}),
    ...(Array.isArray(item.submenu) ? { submenu: brandMenuTemplate(item.submenu) } : {})
  }))
}
