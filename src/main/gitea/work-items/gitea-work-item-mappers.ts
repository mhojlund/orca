import type {
  GitHubAssignableUser,
  IssueInfo
} from '../../../shared/github/pull-requests/pull-request-types'
import type { GitHubWorkItem } from '../../../shared/github/work-items/work-item-types'
import type {
  GitHubIssueTimelineItem,
  PRComment
} from '../../../shared/github/comments/comment-types'
import type { GiteaRepoRef } from '../repository-ref'

export type MainGiteaWorkItem = Omit<GitHubWorkItem, 'repoId'>

export type RawGiteaUser = {
  id?: number
  login?: string | null
  username?: string | null
  full_name?: string | null
  avatar_url?: string | null
  type?: string | null
}

export type RawGiteaLabel = { id?: number; name?: string | null }

export type RawGiteaIssue = {
  number?: number
  title?: string | null
  body?: string | null
  state?: string | null
  html_url?: string | null
  updated_at?: string | null
  comments?: number | null
  user?: RawGiteaUser | null
  labels?: RawGiteaLabel[] | null
  assignees?: RawGiteaUser[] | null
  pull_request?: { merged?: boolean | null; draft?: boolean | null } | null
  repository?: { owner?: string | null; name?: string | null; full_name?: string | null } | null
}

export type RawGiteaPullDetail = {
  number?: number
  merged?: boolean | null
  draft?: boolean | null
  mergeable?: boolean | null
  requested_reviewers?: RawGiteaUser[] | null
  head?: {
    ref?: string | null
    sha?: string | null
    repo?: { full_name?: string | null } | null
  } | null
  base?: { ref?: string | null; repo?: { full_name?: string | null } | null } | null
}

export type RawGiteaComment = {
  id?: number
  body?: string | null
  html_url?: string | null
  created_at?: string | null
  user?: RawGiteaUser | null
}

export type RawGiteaTimelineEvent = RawGiteaComment & {
  type?: string | null
  assignee?: RawGiteaUser | null
  removed_assignee?: boolean | null
  ref_issue?: (RawGiteaIssue & { pull_request?: unknown }) | null
}

export function giteaLogin(user: RawGiteaUser | null | undefined): string | null {
  return user?.login?.trim() || user?.username?.trim() || null
}

export function mapGiteaUser(user: RawGiteaUser): GitHubAssignableUser | null {
  const login = giteaLogin(user)
  return login
    ? { login, name: user.full_name?.trim() || null, avatarUrl: user.avatar_url ?? '' }
    : null
}

function labelNames(labels: RawGiteaLabel[] | null | undefined): string[] {
  return (labels ?? []).map((label) => label.name?.trim() ?? '').filter(Boolean)
}

function isDraftTitle(title: string): boolean {
  return /^\s*(?:\[?wip\]?|draft)\s*:?\s/i.test(title)
}

function isBotUser(user: RawGiteaUser | null | undefined): boolean {
  const login = giteaLogin(user) ?? ''
  return user?.type?.toLowerCase() === 'bot' || /\[bot\]$|-bot$|^renovate|^dependabot/i.test(login)
}

export function giteaItemState(
  raw: RawGiteaIssue,
  pull?: RawGiteaPullDetail | null
): MainGiteaWorkItem['state'] {
  const isPr = raw.pull_request != null || pull != null
  if (isPr && (pull?.merged || raw.pull_request?.merged)) {
    return 'merged'
  }
  if (raw.state === 'closed') {
    return 'closed'
  }
  const title = raw.title ?? ''
  if (isPr && (pull?.draft || raw.pull_request?.draft || isDraftTitle(title))) {
    return 'draft'
  }
  return 'open'
}

function sameRepo(fullName: string | null | undefined, repo: GiteaRepoRef): boolean {
  return fullName?.toLowerCase() === `${repo.owner}/${repo.repo}`.toLowerCase()
}

export function mapGiteaWorkItem(
  raw: RawGiteaIssue,
  repo: GiteaRepoRef,
  pull?: RawGiteaPullDetail | null,
  signals?: Partial<MainGiteaWorkItem> | null
): MainGiteaWorkItem | null {
  const number = raw.number
  if (typeof number !== 'number' || !Number.isInteger(number) || number < 1) {
    return null
  }
  const type = raw.pull_request != null || pull != null ? 'pr' : 'issue'
  const assignees = (raw.assignees ?? [])
    .map(mapGiteaUser)
    .filter((user): user is GitHubAssignableUser => user !== null)
  const headRepo = pull?.head?.repo?.full_name
  return {
    id: `${type}:${number}`,
    type,
    number,
    title: raw.title ?? '',
    state: giteaItemState(raw, pull),
    url:
      raw.html_url ??
      `${repo.webBaseUrl}/${repo.owner}/${repo.repo}/${type === 'pr' ? 'pulls' : 'issues'}/${number}`,
    labels: labelNames(raw.labels),
    updatedAt: raw.updated_at ?? '',
    author: giteaLogin(raw.user),
    ...(raw.user?.avatar_url ? { authorAvatarUrl: raw.user.avatar_url } : {}),
    ...(type === 'issue' && typeof raw.comments === 'number' ? { commentCount: raw.comments } : {}),
    assignees,
    prRepo: { owner: repo.owner, repo: repo.repo, host: repo.host },
    ...(pull?.head?.ref ? { branchName: pull.head.ref } : {}),
    ...(pull?.base?.ref ? { baseRefName: pull.base.ref } : {}),
    ...(pull?.head?.sha ? { headSha: pull.head.sha } : {}),
    ...(pull && headRepo ? { isCrossRepository: !sameRepo(headRepo, repo) } : {}),
    ...(pull
      ? {
          mergeable:
            pull.mergeable === true
              ? 'MERGEABLE'
              : pull.mergeable === false
                ? 'CONFLICTING'
                : 'UNKNOWN'
        }
      : {}),
    ...signals
  }
}

export function mapGiteaIssueInfo(raw: RawGiteaIssue, repo: GiteaRepoRef): IssueInfo | null {
  const item = mapGiteaWorkItem(raw, repo)
  if (!item || item.type !== 'issue') {
    return null
  }
  return {
    number: item.number,
    title: item.title,
    state: raw.state === 'closed' ? 'closed' : 'open',
    url: item.url,
    labels: item.labels,
    ...(raw.body ? { description: raw.body } : {})
  }
}

export function mapGiteaComment(raw: RawGiteaComment): PRComment | null {
  if (typeof raw.id !== 'number') {
    return null
  }
  return {
    id: raw.id,
    author: giteaLogin(raw.user) ?? 'ghost',
    authorAvatarUrl: raw.user?.avatar_url ?? '',
    body: raw.body ?? '',
    createdAt: raw.created_at ?? '',
    url: raw.html_url ?? '',
    isBot: isBotUser(raw.user)
  }
}

function timelineTarget(ref: RawGiteaIssue | null | undefined): GitHubIssueTimelineItem['source'] {
  if (!ref || typeof ref.number !== 'number') {
    return undefined
  }
  return {
    type: ref.pull_request != null ? 'pr' : 'issue',
    number: ref.number,
    title: ref.title ?? '',
    url: ref.html_url ?? '',
    ...(ref.repository?.full_name ? { repository: ref.repository.full_name } : {})
  }
}

/** Maps Gitea timeline types onto GitHub's issue events; unknown types are dropped. */
export function mapGiteaTimelineEvent(raw: RawGiteaTimelineEvent): GitHubIssueTimelineItem | null {
  const base = {
    id: `gitea-timeline-${raw.id ?? ''}`,
    actor: giteaLogin(raw.user) ?? 'ghost',
    actorAvatarUrl: raw.user?.avatar_url ?? '',
    createdAt: raw.created_at ?? ''
  }
  switch (raw.type ?? '') {
    case 'assignees': {
      const assignee = giteaLogin(raw.assignee)
      return {
        ...base,
        event: raw.removed_assignee ? 'unassigned' : 'assigned',
        ...(assignee ? { assignee } : {})
      }
    }
    case 'close':
      return { ...base, event: 'closed' }
    case 'reopen':
      return { ...base, event: 'reopened' }
    case 'issue_ref':
    case 'pull_ref':
    case 'comment_ref':
    case 'commit_ref': {
      const source = timelineTarget(raw.ref_issue)
      return source ? { ...base, event: 'cross-referenced', source } : null
    }
    default:
      return null
  }
}
