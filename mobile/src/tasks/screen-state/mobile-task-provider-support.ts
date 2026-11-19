import type { TaskProvider } from '../../../../src/shared/work-items/task-providers'

// Mobile has no Gitea/Forgejo list, detail or composer surface yet, so it must not offer the tab.
const MOBILE_UNSUPPORTED_TASK_PROVIDERS: ReadonlySet<TaskProvider> = new Set(['gitea'])

export function filterMobileSupportedTaskProviders(
  providers: readonly TaskProvider[]
): TaskProvider[] {
  const supported = providers.filter((provider) => !MOBILE_UNSUPPORTED_TASK_PROVIDERS.has(provider))
  return supported.length > 0 ? supported : ['github']
}
