import type { HostedReviewInfo } from '../../../../../../shared/source-control/hosted-review/hosted-review-contracts'
import {
  parseGitHubIssueOrPRLink,
  type GitHubIssueOrPRLink
} from '../../../../../../shared/github/repositories/links'
import {
  parseGiteaIssueOrPRLink,
  type GiteaIssueOrPRLink
} from '../../../../../../shared/gitea/gitea-links'
import {
  getGiteaTaskUrlCreatePreview,
  matchGiteaPaletteTaskUrl
} from './worktree-palette-gitea-url-match'
import { getGiteaInstanceHosts } from '../../../work-items/gitea/gitea-instance-hosts'
import { parseGitLabIssueOrMRLink } from '../../../../../../shared/new-workspace/gitlab-links'
import {
  parseJiraIssueUrl,
  type ParsedJiraIssueUrl
} from '../../../../../../shared/jira/jira-issue-url'
import {
  parseLinearIssueUrlIntent,
  type LinearIssueUrlIntent
} from '../../../../../../shared/linear/links'
import type { Repo } from '../../../../../../shared/repository/repo-types'
import { getWorkspaceAttachments } from '../../../../../../shared/workspace-attachments/workspace-attachments'
import type { Worktree } from '../../../../../../shared/worktree/types'
import { normalizeLinearIdentifier } from '../../../work-items/linear/linear-issue-workspace-attachment'
import { worktreeMatchesGitHubUrl } from './worktree-palette-github-url-match'
import {
  worktreeMatchesGitLabUrl,
  type GitLabIssueOrMRLink
} from './worktree-palette-gitlab-url-match'
import { isWorktreePaletteQueryTooLarge } from '../../../../../../shared/palette-match/worktree-palette-query-bounds'
import { buildWorktreePaletteTaskUrlResult } from './worktree-palette-task-url-result'
import type { PaletteSearchResult } from './worktree-palette-search'
import { getPaletteWorktreeExecutionHostId } from '../palette-repo-resolution'

export type CmdJTaskSourceUrl =
  | { provider: 'github'; link: GitHubIssueOrPRLink }
  | { provider: 'linear'; intent: LinearIssueUrlIntent }
  | { provider: 'gitlab'; link: GitLabIssueOrMRLink }
  | { provider: 'gitea'; link: GiteaIssueOrPRLink }
  | { provider: 'jira'; parsed: ParsedJiraIssueUrl }

export type CmdJTaskUrlCreatePreview = {
  provider: 'github' | 'gitlab' | 'gitea' | 'jira'
  identifier: string
  subtitle: string
  createLabel: string
  kindLabel: string
  loading?: boolean
}

export function withResolvedCmdJGitHubPreview(
  preview: CmdJTaskUrlCreatePreview,
  resolvedTitle: string | null,
  loading: boolean
): CmdJTaskUrlCreatePreview {
  if (preview.provider !== 'github') {
    return preview
  }
  if (resolvedTitle) {
    return {
      ...preview,
      subtitle: resolvedTitle,
      createLabel: `${preview.createLabel}: ${resolvedTitle}`,
      loading: false
    }
  }
  return loading ? { ...preview, loading: true } : preview
}

export function parseCmdJTaskSourceUrl(
  query: string,
  giteaHosts: ReadonlySet<string> = getGiteaInstanceHosts()
): CmdJTaskSourceUrl | null {
  const trimmed = query.trim()
  if (!trimmed || isWorktreePaletteQueryTooLarge(trimmed)) {
    return null
  }

  const linear = parseLinearIssueUrlIntent(trimmed)
  if (linear) {
    return { provider: 'linear', intent: linear }
  }

  // Why: connected Gitea hosts must claim their /issues/ URLs before GitHub's host-agnostic parser.
  const gitea = parseGiteaIssueOrPRLink(trimmed, giteaHosts)
  if (gitea) {
    return { provider: 'gitea', link: gitea }
  }

  const github = parseGitHubIssueOrPRLink(trimmed)
  if (github) {
    return { provider: 'github', link: github }
  }

  const gitlab = parseGitLabIssueOrMRLink(trimmed)
  if (gitlab) {
    return { provider: 'gitlab', link: gitlab }
  }

  const jira = parseJiraIssueUrl(trimmed)
  if (jira) {
    return { provider: 'jira', parsed: jira }
  }

  return null
}

export function getCmdJTaskUrlCreatePreview(
  intent: CmdJTaskSourceUrl
): CmdJTaskUrlCreatePreview | null {
  if (intent.provider === 'linear') {
    return null
  }
  if (intent.provider === 'github') {
    const { slug, number, type } = intent.link
    const repo = `${slug.owner}/${slug.repo}`
    const kindLabel = type === 'pr' ? 'GitHub pull request' : 'GitHub issue'
    return {
      provider: 'github',
      identifier: `#${number}`,
      subtitle: repo,
      kindLabel,
      createLabel: `Create worktree from ${kindLabel} ${repo}#${number}`
    }
  }
  if (intent.provider === 'gitlab') {
    const { slug, number, type } = intent.link
    const project = `${slug.host}/${slug.path}`
    const kindLabel = type === 'mr' ? 'GitLab merge request' : 'GitLab issue'
    const identifier = type === 'mr' ? `!${number}` : `#${number}`
    return {
      provider: 'gitlab',
      identifier,
      subtitle: project,
      kindLabel,
      createLabel: `Create worktree from ${kindLabel} ${project}${identifier}`
    }
  }
  if (intent.provider === 'gitea') {
    return getGiteaTaskUrlCreatePreview(intent.link)
  }
  return {
    provider: 'jira',
    identifier: intent.parsed.issueKey,
    subtitle: intent.parsed.origin.replace(/^https?:\/\//, ''),
    kindLabel: 'Jira issue',
    createLabel: `Create worktree from Jira issue ${intent.parsed.issueKey}`
  }
}

function worktreeMatchesLinearUrl(worktree: Worktree, intent: LinearIssueUrlIntent): boolean {
  const identifier = normalizeLinearIdentifier(intent.identifier)
  return getWorkspaceAttachments(worktree).some((item) => {
    if (item.provider !== 'linear') {
      return false
    }
    const linkedUrl = item.url ? parseLinearIssueUrlIntent(item.url) : null
    const linkedIdentifier = normalizeLinearIdentifier(
      item.identifier ?? item.linearIdentifier ?? linkedUrl?.identifier
    )
    if (!identifier || linkedIdentifier !== identifier) {
      return false
    }
    const org = (item.linearOrganizationUrlKey ?? linkedUrl?.organizationUrlKey)
      ?.trim()
      .toLowerCase()
    return !org || org === intent.organizationUrlKey.toLowerCase()
  })
}

function worktreeMatchesJiraUrl(worktree: Worktree, parsed: ParsedJiraIssueUrl): boolean {
  return getWorkspaceAttachments(worktree).some((item) => {
    if (item.provider !== 'jira') {
      return false
    }
    const linkedUrl = item.url ? parseJiraIssueUrl(item.url) : null
    if (linkedUrl) {
      return (
        linkedUrl.issueKey === parsed.issueKey &&
        linkedUrl.origin === parsed.origin &&
        linkedUrl.sitePath === parsed.sitePath
      )
    }
    return (item.identifier ?? item.jiraIdentifier)?.toUpperCase() === parsed.issueKey
  })
}

export function matchWorktreePaletteTaskUrl(args: {
  worktree: Worktree
  intent: CmdJTaskSourceUrl
  repo?: Repo
  review?: HostedReviewInfo | null
}): PaletteSearchResult | null {
  const { worktree, intent, repo, review } = args
  const worktreeHostId = getPaletteWorktreeExecutionHostId(worktree)
  if (intent.provider === 'github') {
    if (!worktreeMatchesGitHubUrl(worktree, intent.link, repo, review)) {
      return null
    }
    return buildWorktreePaletteTaskUrlResult({
      worktreeId: worktree.id,
      ...(worktreeHostId ? { worktreeHostId } : {}),
      labelKind: intent.link.type === 'pr' ? 'pr' : 'issue',
      text: `${intent.link.type === 'pr' ? 'PR' : 'Issue'} #${intent.link.number}`
    })
  }
  if (intent.provider === 'gitea') {
    return matchGiteaPaletteTaskUrl({ worktree, link: intent.link, review, worktreeHostId })
  }
  if (intent.provider === 'linear') {
    if (!worktreeMatchesLinearUrl(worktree, intent.intent)) {
      return null
    }
    return buildWorktreePaletteTaskUrlResult({
      worktreeId: worktree.id,
      ...(worktreeHostId ? { worktreeHostId } : {}),
      labelKind: 'issue',
      text: intent.intent.identifier
    })
  }
  if (intent.provider === 'gitlab') {
    if (!worktreeMatchesGitLabUrl(worktree, intent.link, repo, review)) {
      return null
    }
    return buildWorktreePaletteTaskUrlResult({
      worktreeId: worktree.id,
      ...(worktreeHostId ? { worktreeHostId } : {}),
      labelKind: intent.link.type === 'mr' ? 'mr' : 'issue',
      text: `${intent.link.type === 'mr' ? 'MR' : 'Issue'} #${intent.link.number}`
    })
  }
  if (!worktreeMatchesJiraUrl(worktree, intent.parsed)) {
    return null
  }
  return buildWorktreePaletteTaskUrlResult({
    worktreeId: worktree.id,
    ...(worktreeHostId ? { worktreeHostId } : {}),
    labelKind: 'issue',
    text: intent.parsed.issueKey
  })
}
