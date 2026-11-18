import type { GitHubAssignableUser } from '../../../shared/github/pull-requests/pull-request-types'
import type { IssueSourcePreference } from '../../../shared/repository/repo-types'
import type { RemoteRefLocalGitOptions } from '../../git/remotes/remote-ref-probe-cache'
import type { GiteaRepoRef } from '../repository-ref'
import { giteaGet, repoApiPath } from './gitea-api'
import { mapGiteaUser, type RawGiteaLabel, type RawGiteaUser } from './gitea-work-item-mappers'
import { resolveGiteaItemRepo } from './gitea-work-item-source'

const PAGE_LIMIT = 50
const MAX_PAGES = 5

async function listPaged<T>(repo: GiteaRepoRef, path: string): Promise<T[]> {
  const all: T[] = []
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const { data } = await giteaGet<T[]>(repo, path, { page, limit: PAGE_LIMIT })
    const rows = data ?? []
    all.push(...rows)
    if (rows.length < PAGE_LIMIT) {
      break
    }
  }
  return all
}

/** Repo labels plus the owning org's labels; issues can carry either. */
export async function listGiteaLabelRecords(
  repo: GiteaRepoRef
): Promise<{ id: number; name: string }[]> {
  const [repoLabels, orgLabels] = await Promise.all([
    listPaged<RawGiteaLabel>(repo, repoApiPath(repo, '/labels')),
    // User-owned repos answer 404 here.
    listPaged<RawGiteaLabel>(repo, `/orgs/${encodeURIComponent(repo.owner)}/labels`).catch(
      (): RawGiteaLabel[] => []
    )
  ])
  const byName = new Map<string, { id: number; name: string }>()
  for (const label of [...repoLabels, ...orgLabels]) {
    const name = label.name?.trim()
    if (name && typeof label.id === 'number' && !byName.has(name.toLowerCase())) {
      byName.set(name.toLowerCase(), { id: label.id, name })
    }
  }
  return [...byName.values()]
}

/** Gitea addresses labels by id; unknown names are returned for an explicit error. */
export async function resolveGiteaLabelIds(
  repo: GiteaRepoRef,
  names: readonly string[]
): Promise<{ ids: number[]; unknown: string[] }> {
  if (names.length === 0) {
    return { ids: [], unknown: [] }
  }
  const records = await listGiteaLabelRecords(repo)
  const ids: number[] = []
  const unknown: string[] = []
  for (const name of names) {
    const match = records.find((record) => record.name.toLowerCase() === name.trim().toLowerCase())
    if (match) {
      ids.push(match.id)
    } else {
      unknown.push(name)
    }
  }
  return { ids, unknown }
}

export async function listGiteaLabels(
  repoPath: string,
  preference?: IssueSourcePreference,
  connectionId?: string | null,
  localGitOptions: RemoteRefLocalGitOptions = {}
): Promise<string[]> {
  const repo = await resolveGiteaItemRepo(
    repoPath,
    'issue',
    preference,
    connectionId,
    localGitOptions
  )
  if (!repo) {
    return []
  }
  try {
    return (await listGiteaLabelRecords(repo)).map((record) => record.name)
  } catch {
    return []
  }
}

export async function listGiteaAssignableUsers(
  repoPath: string,
  preference?: IssueSourcePreference,
  connectionId?: string | null,
  localGitOptions: RemoteRefLocalGitOptions = {}
): Promise<GitHubAssignableUser[]> {
  const repo = await resolveGiteaItemRepo(
    repoPath,
    'issue',
    preference,
    connectionId,
    localGitOptions
  )
  if (!repo) {
    return []
  }
  try {
    const { data } = await giteaGet<RawGiteaUser[]>(repo, repoApiPath(repo, '/assignees'))
    return (data ?? [])
      .map(mapGiteaUser)
      .filter((user): user is GitHubAssignableUser => user !== null)
  } catch {
    return []
  }
}
