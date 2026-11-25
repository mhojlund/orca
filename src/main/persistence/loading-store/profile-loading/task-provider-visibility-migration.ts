import type { GlobalSettings } from '../../../../shared/settings/global-settings-types'
import type { TaskProvider } from '../../../../shared/work-items/task-providers'

const ONE_SHOT_PROVIDERS = [
  { provider: 'jira', flag: 'visibleTaskProvidersDefaultedForJira' },
  { provider: 'gitea', flag: 'visibleTaskProvidersDefaultedForGitea' }
] as const

/** Adds providers introduced after a profile was saved, once, so a later opt-out sticks. */
export function addNewlyDefaultedTaskProviders(
  visible: readonly TaskProvider[],
  saved: Partial<GlobalSettings> | undefined
): { providers: TaskProvider[]; needsSave: boolean } {
  const pending = ONE_SHOT_PROVIDERS.filter(({ flag }) => saved?.[flag] !== true)
  return {
    providers: [
      ...visible,
      ...pending.map(({ provider }) => provider).filter((provider) => !visible.includes(provider))
    ],
    needsSave: pending.length > 0
  }
}
