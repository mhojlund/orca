import type { GitHubRepositoryIdentity as GitHubOwnerRepo } from '../../../shared/github/repositories/repository-identity'
import type { GitHubWorkItemDetails } from '../../../shared/github/work-items/work-item-types'
import type {
  GitHubAssignableUser,
  IssueInfo
} from '../../../shared/github/pull-requests/pull-request-types'
import type { IssueSourcePreference } from '../../../shared/repository/repo-types'
import type { RemoteRefLocalGitOptions } from '../../git/remotes/remote-ref-probe-cache'
import { HostedReviewApiRequestError } from '../../source-control/hosted-review-api-request'
import { normalizeGiteaApiBaseUrl } from '../gitea-api-base-url'
import { findGiteaInstanceForRepo } from '../instances/gitea-auth-resolution'
import { listStoredGiteaInstances } from '../instances/gitea-instance-store'
import type { GiteaRepoRef } from '../repository-ref'
import { giteaGet, repoApiPath } from './gitea-api'
import { isGiteaHost } from './gitea-host-eligibility'
import {
  giteaLogin,
  mapGiteaComment,
  mapGiteaIssueInfo,
  mapGiteaTimelineEvent,
  mapGiteaUser,
  mapGiteaWorkItem,
  type MainGiteaWorkItem,
  type RawGiteaComment,
  type RawGiteaIssue,
  type RawGiteaPullDetail,
  type RawGiteaTimelineEvent,
  type RawGiteaUser
} from './gitea-work-item-mappers'
import { resolveGiteaItemRepo } from './gitea-work-item-source'

function isNotFound(error: unknown): boolean {
  return error instanceof HostedReviewApiRequestError && error.status === 404
}

async function fetchRawIssue(
  repo: GiteaRepoRef,
  number: number,
  noCache = false
): Promise<RawGiteaIssue | null> {
  // Gitea's issues endpoint serves PRs too, flagged by `pull_request`.
  const { data } = await giteaGet<RawGiteaIssue>(
    repo,
    repoApiPath(repo, `/issues/${number}`),
    undefined,
    { noCache }
  )
  return data
}

async function fetchPullDetail(
  repo: GiteaRepoRef,
  number: number,
  noCache = false
): Promise<RawGiteaPullDetail | null> {
  const { data } = await giteaGet<RawGiteaPullDetail>(
    repo,
    repoApiPath(repo, `/pulls/${number}`),
    undefined,
    { noCache }
  )
  return data
}

export async function readGiteaWorkItem(
  repo: GiteaRepoRef,
  number: number,
  type?: 'issue' | 'pr',
  noCache = false
): Promise<MainGiteaWorkItem | null> {
  try {
    const raw = await fetchRawIssue(repo, number, noCache)
    if (!raw) {
      return null
    }
    const isPr = raw.pull_request != null
    if (type && (type === 'pr') !== isPr) {
      return null
    }
    return mapGiteaWorkItem(raw, repo, isPr ? await fetchPullDetail(repo, number, noCache) : null)
  } catch (error) {
    if (isNotFound(error)) {
      return null
    }
    throw error
  }
}

export async function getGiteaWorkItem(
  repoPath: string,
  number: number,
  type?: 'issue' | 'pr',
  connectionId?: string | null,
  localGitOptions: RemoteRefLocalGitOptions = {},
  preference?: IssueSourcePreference
): Promise<MainGiteaWorkItem | null> {
  const repo = await resolveGiteaItemRepo(
    repoPath,
    type ?? 'issue',
    preference,
    connectionId,
    localGitOptions
  )
  if (!repo) {
    return null
  }
  try {
    return await readGiteaWorkItem(repo, number, type)
  } catch {
    return null
  }
}

/** Builds a ref for a pasted URL's repository; tokens still only go to a matching stored instance. */
export async function giteaRepoRefForOwnerRepo(
  ownerRepo: GitHubOwnerRepo
): Promise<GiteaRepoRef | null> {
  const host = ownerRepo.host?.trim().toLowerCase()
  if (!host) {
    return null
  }
  const webOrigin = `https://${host}`
  const instance = findGiteaInstanceForRepo(
    { host, webBaseUrl: webOrigin, apiBaseUrl: normalizeGiteaApiBaseUrl(webOrigin) },
    await listStoredGiteaInstances()
  )
  const webBaseUrl = instance?.webBaseUrl ?? webOrigin
  return {
    host,
    owner: ownerRepo.owner,
    repo: ownerRepo.repo,
    webBaseUrl,
    apiBaseUrl: instance?.apiBaseUrl ?? normalizeGiteaApiBaseUrl(webBaseUrl)
  }
}

export async function getGiteaWorkItemByOwnerRepo(
  ownerRepo: GitHubOwnerRepo,
  number: number,
  type: 'issue' | 'pr'
): Promise<MainGiteaWorkItem | null> {
  const repo = await giteaRepoRefForOwnerRepo(ownerRepo)
  if (!repo || !(await isGiteaHost(repo))) {
    return null
  }
  try {
    return await readGiteaWorkItem(repo, number, type)
  } catch {
    return null
  }
}

export async function getGiteaIssue(
  repoPath: string,
  number: number,
  connectionId?: string | null,
  localGitOptions: RemoteRefLocalGitOptions = {},
  preference?: IssueSourcePreference
): Promise<IssueInfo | null> {
  const repo = await resolveGiteaItemRepo(
    repoPath,
    'issue',
    preference,
    connectionId,
    localGitOptions
  )
  if (!repo) {
    return null
  }
  try {
    const raw = await fetchRawIssue(repo, number)
    return raw ? mapGiteaIssueInfo(raw, repo) : null
  } catch {
    return null
  }
}

async function listOrEmpty<T>(read: () => Promise<{ data: T[] | null }>): Promise<T[]> {
  try {
    return (await read()).data ?? []
  } catch (error) {
    // Older servers lack the timeline endpoint; show comments without events.
    if (isNotFound(error)) {
      return []
    }
    throw error
  }
}

function collectParticipants(users: (RawGiteaUser | null | undefined)[]): GitHubAssignableUser[] {
  const byLogin = new Map<string, GitHubAssignableUser>()
  for (const user of users) {
    const mapped = user ? mapGiteaUser(user) : null
    if (mapped && !byLogin.has(mapped.login.toLowerCase())) {
      byLogin.set(mapped.login.toLowerCase(), mapped)
    }
  }
  return [...byLogin.values()]
}

export async function getGiteaWorkItemDetails(
  repoPath: string,
  number: number,
  type?: 'issue' | 'pr',
  connectionId?: string | null,
  localGitOptions: RemoteRefLocalGitOptions = {},
  preference?: IssueSourcePreference
): Promise<GitHubWorkItemDetails | null> {
  const repo = await resolveGiteaItemRepo(
    repoPath,
    type ?? 'issue',
    preference,
    connectionId,
    localGitOptions
  )
  if (!repo) {
    return null
  }
  // Details back the open dialog; read fresh so external edits appear on open.
  const raw = await fetchRawIssue(repo, number, true).catch((error: unknown) => {
    if (isNotFound(error)) {
      return null
    }
    throw error
  })
  if (!raw) {
    return null
  }
  const isPr = raw.pull_request != null
  const [pull, rawComments, rawTimeline] = await Promise.all([
    isPr ? fetchPullDetail(repo, number, true) : Promise.resolve(null),
    listOrEmpty(() =>
      giteaGet<RawGiteaComment[]>(
        repo,
        repoApiPath(repo, `/issues/${number}/comments`),
        undefined,
        {
          noCache: true
        }
      )
    ),
    isPr
      ? Promise.resolve<RawGiteaTimelineEvent[]>([])
      : listOrEmpty(() =>
          giteaGet<RawGiteaTimelineEvent[]>(
            repo,
            repoApiPath(repo, `/issues/${number}/timeline`),
            { limit: 300 },
            { noCache: true }
          )
        )
  ])
  const item = mapGiteaWorkItem(raw, repo, pull)
  if (!item) {
    return null
  }
  const comments = rawComments
    .map(mapGiteaComment)
    .filter((comment): comment is NonNullable<typeof comment> => comment !== null)
  const timelineItems = rawTimeline
    .map(mapGiteaTimelineEvent)
    .filter((event): event is NonNullable<typeof event> => event !== null)
  return {
    item,
    body: raw.body ?? '',
    comments,
    ...(isPr ? {} : { timelineItems }),
    participants: collectParticipants([
      raw.user,
      ...(raw.assignees ?? []),
      ...rawComments.map((comment) => comment.user),
      ...rawTimeline.map((event) => event.user)
    ]),
    ...(isPr
      ? {}
      : {
          assignees: (raw.assignees ?? [])
            .map(giteaLogin)
            .filter((login): login is string => login !== null)
        })
  }
}
