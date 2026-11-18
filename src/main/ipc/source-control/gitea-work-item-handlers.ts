import { ipcMain } from 'electron'
import type { GitHubRepositoryIdentity as GitHubOwnerRepo } from '../../../shared/github/repositories/repository-identity'
import type {
  GitHubCreateIssueFields,
  GitHubIssueUpdate
} from '../../../shared/work-items/issue-mutation-types'
import type { Repo } from '../../../shared/repository/repo-types'
import {
  countGiteaWorkItems,
  listGiteaWorkItems
} from '../../gitea/work-items/list-gitea-work-items'
import {
  getGiteaIssue,
  getGiteaWorkItem,
  getGiteaWorkItemByOwnerRepo,
  getGiteaWorkItemDetails
} from '../../gitea/work-items/gitea-work-item-read'
import {
  addGiteaIssueComment,
  createGiteaIssue,
  updateGiteaIssue
} from '../../gitea/work-items/gitea-issue-mutations'
import {
  listGiteaAssignableUsers,
  listGiteaLabels
} from '../../gitea/work-items/gitea-issue-field-options'
import { uploadGiteaIssueImage } from '../../gitea/work-items/gitea-image-upload'
import type { Store } from '../../persistence/loading-store/store'
import { sendToTrustedUIRenderer } from '../ui'
import { dispatchWorkItem, type WorkItemArgs } from './github-work-item-args'
import {
  assertRegisteredGiteaRepo,
  getGitHubLocalGitOptionArgs,
  getGitHubRepoConnectionId,
  readGitHubRepoUnlessWslStopped,
  type GitHubRepoScopedArgs
} from './github-repo-routing'

type ListArgs = GitHubRepoScopedArgs & {
  limit?: number
  query?: string
  page?: number
  noCache?: boolean
  wakeWslDistro?: boolean
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1
}

export function broadcastGiteaWorkItemMutation(
  payload: { repoPath: string; repoId?: string; type: 'issue' | 'pr'; number: number },
  senderId?: number
): void {
  sendToTrustedUIRenderer('gitea:workItemMutated', payload, senderId)
}

export function registerGiteaWorkItemHandlers(store: Store): void {
  const locator = (repo: Repo) => ({
    repoPath: repo.path,
    preference: repo.issueSourcePreference,
    connectionId: getGitHubRepoConnectionId(repo),
    localGitOptions: getGitHubLocalGitOptionArgs(store, repo)[0]
  })
  const localOptions = (repo: Repo) => getGitHubLocalGitOptionArgs(store, repo)[0] ?? {}

  ipcMain.handle('gitea:listWorkItems', (_event, args: ListArgs) => {
    const repo = assertRegisteredGiteaRepo(args, store)
    return readGitHubRepoUnlessWslStopped(
      store,
      repo,
      () =>
        listGiteaWorkItems(
          repo.path,
          args.limit,
          args.query,
          args.page,
          repo.issueSourcePreference,
          getGitHubRepoConnectionId(repo),
          args.noCache,
          localOptions(repo)
        ),
      { wake: args.wakeWslDistro === true }
    )
  })

  ipcMain.handle('gitea:countWorkItems', (_event, args: ListArgs) => {
    const repo = assertRegisteredGiteaRepo(args, store)
    return readGitHubRepoUnlessWslStopped(
      store,
      repo,
      () =>
        countGiteaWorkItems(
          repo.path,
          args.query,
          repo.issueSourcePreference,
          getGitHubRepoConnectionId(repo),
          localOptions(repo)
        ),
      { wake: args.wakeWslDistro === true }
    )
  })

  ipcMain.handle('gitea:issue', (_event, args: GitHubRepoScopedArgs & { number: number }) => {
    const repo = assertRegisteredGiteaRepo(args, store)
    if (!isPositiveInteger(args.number)) {
      return null
    }
    return readGitHubRepoUnlessWslStopped(
      store,
      repo,
      () =>
        getGiteaIssue(
          repo.path,
          args.number,
          getGitHubRepoConnectionId(repo),
          localOptions(repo),
          repo.issueSourcePreference
        ),
      { retryStartsIt: false }
    )
  })

  ipcMain.handle('gitea:workItem', (_event, args: WorkItemArgs) => {
    const repo = assertRegisteredGiteaRepo(args, store)
    return dispatchWorkItem(args, repo, getGiteaWorkItem, localOptions(repo))
  })

  ipcMain.handle(
    'gitea:workItemByOwnerRepo',
    (
      _event,
      args: GitHubRepoScopedArgs & {
        owner: string
        repo: string
        host?: string
        number: number
        type: 'issue' | 'pr'
      }
    ) => {
      assertRegisteredGiteaRepo(args, store)
      if (!isPositiveInteger(args.number) || (args.type !== 'issue' && args.type !== 'pr')) {
        return null
      }
      return getGiteaWorkItemByOwnerRepo(
        { owner: args.owner, repo: args.repo, ...(args.host ? { host: args.host } : {}) },
        args.number,
        args.type
      )
    }
  )

  ipcMain.handle('gitea:workItemDetails', (_event, args: WorkItemArgs) => {
    const repo = assertRegisteredGiteaRepo(args, store)
    return dispatchWorkItem(args, repo, getGiteaWorkItemDetails, localOptions(repo))
  })

  ipcMain.handle(
    'gitea:createIssue',
    (
      _event,
      args: GitHubRepoScopedArgs & { title: string; body: string } & GitHubCreateIssueFields
    ) => {
      const repo = assertRegisteredGiteaRepo(args, store)
      return createGiteaIssue(locator(repo), String(args.title ?? ''), String(args.body ?? ''), {
        labels: Array.isArray(args.labels) ? args.labels.map(String) : undefined,
        assignees: Array.isArray(args.assignees) ? args.assignees.map(String) : undefined
      })
    }
  )

  ipcMain.handle(
    'gitea:updateIssue',
    async (event, args: GitHubRepoScopedArgs & { number: number; updates: GitHubIssueUpdate }) => {
      const repo = assertRegisteredGiteaRepo(args, store)
      if (!isPositiveInteger(args.number)) {
        return { ok: false, error: 'Invalid issue number' }
      }
      if (!args.updates || typeof args.updates !== 'object') {
        return { ok: false, error: 'Updates object is required' }
      }
      const result = await updateGiteaIssue(locator(repo), args.number, args.updates)
      if (result.ok) {
        broadcastGiteaWorkItemMutation(
          { repoPath: repo.path, repoId: repo.id, type: 'issue', number: args.number },
          event.sender.id
        )
      }
      return result
    }
  )

  ipcMain.handle(
    'gitea:addIssueComment',
    async (
      event,
      args: GitHubRepoScopedArgs & {
        number: number
        body: string
        type?: 'issue' | 'pr'
        prRepo?: GitHubOwnerRepo | null
      }
    ) => {
      const repo = assertRegisteredGiteaRepo(args, store)
      if (!isPositiveInteger(args.number)) {
        return { ok: false, error: 'Invalid issue number' }
      }
      if (!args.body?.trim()) {
        return { ok: false, error: 'Comment body required' }
      }
      const type = args.type === 'pr' ? 'pr' : 'issue'
      const result = await addGiteaIssueComment(locator(repo), args.number, args.body.trim(), type)
      if (result.ok) {
        broadcastGiteaWorkItemMutation(
          { repoPath: repo.path, repoId: repo.id, type, number: args.number },
          event.sender.id
        )
      }
      return result
    }
  )

  ipcMain.handle('gitea:listLabels', (_event, args: GitHubRepoScopedArgs) => {
    const repo = assertRegisteredGiteaRepo(args, store)
    const target = locator(repo)
    return listGiteaLabels(
      target.repoPath,
      target.preference,
      target.connectionId,
      target.localGitOptions
    )
  })

  ipcMain.handle('gitea:listAssignableUsers', (_event, args: GitHubRepoScopedArgs) => {
    const repo = assertRegisteredGiteaRepo(args, store)
    const target = locator(repo)
    return listGiteaAssignableUsers(
      target.repoPath,
      target.preference,
      target.connectionId,
      target.localGitOptions
    )
  })

  ipcMain.handle(
    'gitea:uploadImage',
    (
      _event,
      args: GitHubRepoScopedArgs & {
        number: number
        fileName: string
        contentType: string
        bytes: Uint8Array
      }
    ) => {
      const repo = assertRegisteredGiteaRepo(args, store)
      if (!isPositiveInteger(args.number) || !(args.bytes instanceof Uint8Array)) {
        throw new Error('Invalid image upload request')
      }
      return uploadGiteaIssueImage({
        ...locator(repo),
        issueNumber: args.number,
        fileName: String(args.fileName || 'image'),
        contentType: String(args.contentType),
        bytes: Buffer.from(args.bytes)
      })
    }
  )

  ipcMain.handle(
    'gitea:notifyWorkItemMutated',
    (event, args: { repoPath: string; repoId?: string; type: 'issue' | 'pr'; number: number }) => {
      const repo = args.repoId
        ? store.getRepos().find((candidate) => candidate.id === args.repoId)
        : assertRegisteredGiteaRepo(args, store)
      if (
        !repo ||
        (args.type !== 'issue' && args.type !== 'pr') ||
        !isPositiveInteger(args.number)
      ) {
        return false
      }
      broadcastGiteaWorkItemMutation(
        { repoPath: repo.path, repoId: repo.id, type: args.type, number: args.number },
        event.sender.id
      )
      return true
    }
  )
}
