import type { PreflightStatus } from '../../../../preload/api/preflight/preflight-api'
import type { TaskProvider } from '../../../../shared/work-items/task-providers'

/** Returns null until provider status is known, so callers keep the saved default meanwhile. */
export function getConfiguredTaskProviders(args: {
  preflightStatus: PreflightStatus | null | undefined
  preflightReady: boolean
  linearConnected: boolean
  jiraConnected: boolean
}): ReadonlySet<TaskProvider> | null {
  const { preflightStatus, preflightReady } = args
  if (!preflightReady || !preflightStatus) {
    return null
  }
  const configured = new Set<TaskProvider>()
  if (preflightStatus.gh?.installed && preflightStatus.gh.authenticated) {
    configured.add('github')
  }
  if (preflightStatus.glab?.installed && preflightStatus.glab.authenticated) {
    configured.add('gitlab')
  }
  const gitea = preflightStatus.gitea
  if (gitea?.configured && !(gitea.tokenConfigured && !gitea.authenticated)) {
    configured.add('gitea')
  }
  if (args.linearConnected) {
    configured.add('linear')
  }
  if (args.jiraConnected) {
    configured.add('jira')
  }
  return configured
}
