import { app } from 'electron'
import classicIcon from '../../../../resources/icon.png?asset'
import classicRsIcon from '../../../../resources/icon-rs.png?asset'
import classicDevIcon from '../../../../resources/icon-dev.png?asset'
import classicDevMacIcon from '../../../../resources/icon-dev-mac.png?asset'
import watercolorIcon from '../../../../resources/app-icons/orca-watercolor.png?asset'
import watercolorMacIcon from '../../../../resources/app-icons/orca-watercolor-mac.png?asset'
import blueIcon from '../../../../resources/app-icons/orca-blue.png?asset'
import type { BuiltInAppIconId } from '../../../shared/app-lifecycle/identity/app-icon'
import { getActiveAppFlavor } from '../../startup/app-flavor-state'

const isMac = process.platform === 'darwin'

const FLAVOR_CLASSIC_ICON_PATHS: Readonly<Record<string, string>> = { rs: classicRsIcon }

// The -mac variants sit in Apple's 824/1024 icon tile; Windows and Linux keep their larger tiles (#5357).
const ALTERNATE_APP_ICON_PATHS = {
  watercolor: isMac ? watercolorMacIcon : watercolorIcon,
  blue: blueIcon
} satisfies Record<Exclude<BuiltInAppIconId, 'classic'>, string>

// Resolved per call: the flavor is only known once startup has read the packaged package.json.
export function getClassicAppIconPath(): string {
  if (!app.isPackaged) {
    return isMac ? classicDevMacIcon : classicDevIcon
  }
  const flavorId = getActiveAppFlavor()?.id
  return (flavorId && FLAVOR_CLASSIC_ICON_PATHS[flavorId]) || classicIcon
}

export function getBuiltInAppIconPath(iconId: BuiltInAppIconId): string {
  return iconId === 'classic' ? getClassicAppIconPath() : ALTERNATE_APP_ICON_PATHS[iconId]
}
