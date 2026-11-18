import type { GitHubCommentResult } from '../../../shared/github/comments/comment-types'
import type {
  GitHubCreateIssueFields,
  GitHubCreateIssueResult,
  GitHubIssueUpdate
} from '../../../shared/work-items/issue-mutation-types'
import type { IssueSourcePreference } from '../../../shared/repository/repo-types'
import {
  classifiedFailure,
  codeHostFailure,
  type CodeHostFailure
} from '../../../shared/source-control/code-host-failure-copy'
import type { RemoteRefLocalGitOptions } from '../../git/remotes/remote-ref-probe-cache'
import type { GiteaRepoRef } from '../repository-ref'
import { giteaGet, giteaSend, repoApiPath } from './gitea-api'
import { classifyGiteaError } from './gitea-error-classification'
import { resolveGiteaLabelIds } from './gitea-issue-field-options'
import { isGiteaRepoAuthenticated } from './gitea-viewer'
import {
  giteaLogin,
  mapGiteaComment,
  type RawGiteaComment,
  type RawGiteaIssue
} from './gitea-work-item-mappers'
import { resolveGiteaItemRepo } from './gitea-work-item-source'

type RepoLocator = {
  repoPath: string
  preference?: IssueSourcePreference
  connectionId?: string | null
  localGitOptions?: RemoteRefLocalGitOptions
}

async function issueRepo(locator: RepoLocator, type: 'issue' | 'pr' = 'issue') {
  return resolveGiteaItemRepo(
    locator.repoPath,
    type,
    locator.preference,
    locator.connectionId,
    locator.localGitOptions ?? {}
  )
}

function failure(error: unknown, repo: GiteaRepoRef): CodeHostFailure {
  return classifiedFailure(classifyGiteaError(error, isGiteaRepoAuthenticated(repo)))
}

export async function createGiteaIssue(
  locator: RepoLocator,
  title: string,
  body: string,
  fields?: GitHubCreateIssueFields
): Promise<GitHubCreateIssueResult> {
  if (!title.trim()) {
    return codeHostFailure('titleRequired')
  }
  const repo = await issueRepo(locator)
  if (!repo) {
    return codeHostFailure('gitea.repoUnresolved')
  }
  try {
    const labels = await resolveGiteaLabelIds(repo, fields?.labels ?? [])
    if (labels.unknown.length > 0) {
      return codeHostFailure('invalidRequest', `unknown labels: ${labels.unknown.join(', ')}`)
    }
    const created = await giteaSend<RawGiteaIssue>(repo, 'POST', repoApiPath(repo, '/issues'), {
      title: title.trim(),
      body,
      ...(labels.ids.length > 0 ? { labels: labels.ids } : {}),
      ...(fields?.assignees?.length ? { assignees: fields.assignees } : {})
    })
    if (!created || typeof created.number !== 'number') {
      return codeHostFailure('gitea.requestFailed', 'missing issue number in response')
    }
    return { ok: true, number: created.number, url: created.html_url ?? '' }
  } catch (error) {
    return failure(error, repo)
  }
}

async function nextAssignees(
  repo: GiteaRepoRef,
  number: number,
  updates: GitHubIssueUpdate
): Promise<string[] | undefined> {
  if (!updates.addAssignees?.length && !updates.removeAssignees?.length) {
    return undefined
  }
  // Gitea's PATCH replaces the whole assignee list, so start from the live one.
  const { data } = await giteaGet<RawGiteaIssue>(
    repo,
    repoApiPath(repo, `/issues/${number}`),
    undefined,
    { noCache: true }
  )
  const removed = new Set((updates.removeAssignees ?? []).map((login) => login.toLowerCase()))
  const next = (data?.assignees ?? [])
    .map(giteaLogin)
    .filter((login): login is string => login !== null && !removed.has(login.toLowerCase()))
  for (const login of updates.addAssignees ?? []) {
    if (!next.some((existing) => existing.toLowerCase() === login.toLowerCase())) {
      next.push(login)
    }
  }
  return next
}

export async function updateGiteaIssue(
  locator: RepoLocator,
  number: number,
  updates: GitHubIssueUpdate
): Promise<{ ok: true } | CodeHostFailure> {
  if (
    updates.duplicateOf !== undefined ||
    (updates.stateReason !== undefined && updates.stateReason !== 'completed')
  ) {
    return codeHostFailure('gitea.closeReasonUnsupported')
  }
  const repo = await issueRepo(locator)
  if (!repo) {
    return codeHostFailure('gitea.repoUnresolved')
  }
  try {
    const [addLabels, removeLabels] = await Promise.all([
      resolveGiteaLabelIds(repo, updates.addLabels ?? []),
      resolveGiteaLabelIds(repo, updates.removeLabels ?? [])
    ])
    if (addLabels.unknown.length > 0) {
      return codeHostFailure('invalidUpdate', `unknown labels: ${addLabels.unknown.join(', ')}`)
    }
    const assignees = await nextAssignees(repo, number, updates)
    const patch = {
      ...(updates.title !== undefined ? { title: updates.title } : {}),
      ...(updates.body !== undefined ? { body: updates.body } : {}),
      ...(updates.state !== undefined ? { state: updates.state } : {}),
      ...(assignees !== undefined ? { assignees } : {})
    }
    if (Object.keys(patch).length > 0) {
      await giteaSend(repo, 'PATCH', repoApiPath(repo, `/issues/${number}`), patch)
    }
    if (addLabels.ids.length > 0) {
      await giteaSend(repo, 'POST', repoApiPath(repo, `/issues/${number}/labels`), {
        labels: addLabels.ids
      })
    }
    for (const id of removeLabels.ids) {
      await giteaSend(repo, 'DELETE', repoApiPath(repo, `/issues/${number}/labels/${id}`))
    }
    return { ok: true }
  } catch (error) {
    return failure(error, repo)
  }
}

export async function addGiteaIssueComment(
  locator: RepoLocator,
  number: number,
  body: string,
  type: 'issue' | 'pr' = 'issue'
): Promise<GitHubCommentResult> {
  const repo = await issueRepo(locator, type)
  if (!repo) {
    return codeHostFailure('gitea.repoUnresolved')
  }
  try {
    const created = await giteaSend<RawGiteaComment>(
      repo,
      'POST',
      repoApiPath(repo, `/issues/${number}/comments`),
      { body }
    )
    const comment = created ? mapGiteaComment(created) : null
    return comment
      ? { ok: true, comment }
      : codeHostFailure('gitea.requestFailed', 'missing comment in response')
  } catch (error) {
    return failure(error, repo)
  }
}
