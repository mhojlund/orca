import type { PreloadApi } from '../../../../preload/api-types'
import type { TaskProvider } from '../../../../shared/work-items/task-providers'

/** Forges whose issues/work items share GitHub's data shapes and `<provider>:<method>` channels. */
export type WorkItemForgeProvider = 'github' | 'gitea'

export type WorkItemForgeMethod =
  | 'issue'
  | 'workItem'
  | 'workItemByOwnerRepo'
  | 'workItemDetails'
  | 'notifyWorkItemMutated'
  | 'createIssue'
  | 'countWorkItems'
  | 'listWorkItems'
  | 'updateIssue'
  | 'addIssueComment'
  | 'listLabels'
  | 'listAssignableUsers'
  | 'onWorkItemMutated'

export type WorkItemForgeIpcApi = Pick<PreloadApi['gh'], WorkItemForgeMethod>

export type WorkItemForgeCapabilities = {
  /** GitHub can close as "not planned" or "duplicate"; Gitea only has open/closed. */
  closeReasons: boolean
  projects: boolean
  accountBinding: boolean
  rateLimitBudget: boolean
}

const FORGE_PROVIDER_BY_TASK_PROVIDER: Partial<Record<TaskProvider, WorkItemForgeProvider>> = {
  github: 'github',
  gitea: 'gitea'
}

const CAPABILITIES: Record<WorkItemForgeProvider, WorkItemForgeCapabilities> = {
  github: { closeReasons: true, projects: true, accountBinding: true, rateLimitBudget: true },
  gitea: { closeReasons: false, projects: false, accountBinding: false, rateLimitBudget: false }
}

/** True when the source's work items come through the GitHub-shaped forge contract. */
export function isWorkItemForgeSource(
  sourceContext: { provider: TaskProvider } | null | undefined
): boolean {
  return sourceContext?.provider === 'github' || sourceContext?.provider === 'gitea'
}

/** Which forge serves a task source's work items; unmapped sources fall back to GitHub's contract. */
export function workItemForgeProviderFor(
  sourceContext: { provider: TaskProvider } | null | undefined
): WorkItemForgeProvider {
  return (sourceContext && FORGE_PROVIDER_BY_TASK_PROVIDER[sourceContext.provider]) || 'github'
}

export function workItemForgeIpc(provider: WorkItemForgeProvider): WorkItemForgeIpcApi {
  return provider === 'gitea' ? window.api.gitea : window.api.gh
}

export function workItemRpcMethod<M extends WorkItemForgeMethod>(
  provider: WorkItemForgeProvider,
  method: M
): `${WorkItemForgeProvider}.${M}` {
  return `${provider}.${method}`
}

export function workItemForgeCapabilities(
  provider: WorkItemForgeProvider
): WorkItemForgeCapabilities {
  return CAPABILITIES[provider]
}
