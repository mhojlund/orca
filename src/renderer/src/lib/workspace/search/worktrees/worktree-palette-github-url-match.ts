import { foldComparableGitHubHost } from '../../../../../../shared/git/remotes/git-remote-host-alias'
import {
  matchGitRemoteKeyParts,
  splitGitRemoteKey,
  type GitRemoteKeyParts
} from '../../../../../../shared/git/remotes/git-remote-identity'
import type { HostedReviewInfo } from '../../../../../../shared/source-control/hosted-review/hosted-review-contracts'
import {
  parseGitHubIssueOrPRLink,
  type GitHubIssueOrPRLink,
  type RepoSlug
} from '../../../../../../shared/github/repositories/links'
import { githubRepoIdentityKey } from '../../../../../../shared/github/repositories/repository-identity-key'
import type { Repo } from '../../../../../../shared/repository/repo-types'
import { getWorkspaceAttachments } from '../../../../../../shared/workspace-attachments/workspace-attachments'
import type { Worktree } from '../../../../../../shared/worktree/types'

function githubIdentityKey(slug: RepoSlug): string {
  return githubRepoIdentityKey({
    owner: slug.owner,
    repo: slug.repo,
    host: slug.host?.replace(/^www\./i, '')
  })
}

function githubLinksEqual(left: GitHubIssueOrPRLink, right: GitHubIssueOrPRLink): boolean {
  return (
    left.type === right.type &&
    left.number === right.number &&
    githubIdentityKey(left.slug) === githubIdentityKey(right.slug)
  )
}

function parseOwnerRepoDisplayName(value: string | null | undefined): RepoSlug | null {
  const match = /^([^/]+)\/([^/]+)$/.exec(value?.trim() ?? '')
  if (!match) {
    return null
  }
  return { owner: match[1], repo: match[2] }
}

/** Host + `owner/repo` tail, matching how `GitRemoteIdentity.canonicalKey` is built. */
function githubRemoteKeyParts(slug: RepoSlug): GitRemoteKeyParts {
  return {
    host: foldComparableGitHubHost((slug.host || 'github.com').replace(/:\d+$/, '')),
    tail: `${slug.owner.toLowerCase()}/${slug.repo.replace(/\.git$/i, '').toLowerCase()}`
  }
}

function remoteIdentityMatchesGitHubSlug(repo: Repo, slug: RepoSlug): boolean | 'unknown' {
  const identity = repo.gitRemoteIdentity
  const identityParts = splitGitRemoteKey(identity?.canonicalKey, foldComparableGitHubHost)
  if (!identityParts) {
    return 'unknown'
  }
  const verdict = matchGitRemoteKeyParts(identityParts, githubRemoteKeyParts(slug))
  if (verdict !== false) {
    return verdict
  }
  // Single-remote identity can hide a fork’s origin behind upstream; remain permissive for fork URLs. GitLab makes the opposite trade (STA-4450); alignment needs a separate change.
  return identity?.remoteName === 'upstream' ? 'unknown' : false
}

/** Tri-state: `'unknown'` stays permissive for forks and host aliases. */
function repoMatchesGitHubSlug(repo: Repo | undefined, slug: RepoSlug): boolean | 'unknown' {
  if (!repo) {
    return 'unknown'
  }
  // Host-agnostic displayName preserves mirror/alias matching; probed remote fills only missing name evidence.
  const fromName = parseOwnerRepoDisplayName(repo.displayName)
  if (fromName) {
    return githubIdentityKey({ ...fromName, host: slug.host }) === githubIdentityKey(slug)
  }
  if (repo.upstream?.owner && repo.upstream.repo) {
    return githubIdentityKey(repo.upstream) === githubIdentityKey(slug)
  }
  // Basename-only names are common; repo-scoped bare numbers still need the actual remote gate.
  return remoteIdentityMatchesGitHubSlug(repo, slug)
}

export function worktreeMatchesGitHubUrl(
  worktree: Worktree,
  link: GitHubIssueOrPRLink,
  repo: Repo | undefined,
  review: HostedReviewInfo | null | undefined
): boolean {
  const attachments = getWorkspaceAttachments(worktree).filter((item) => item.provider === 'github')
  const attachmentMatch = attachments.some((item) => {
    const itemUrl = item.url ? parseGitHubIssueOrPRLink(item.url) : null
    if (itemUrl) {
      return githubLinksEqual(itemUrl, link)
    }
    return (
      item.type === link.type &&
      item.number === link.number &&
      repoMatchesGitHubSlug(repo, link.slug) !== false
    )
  })
  const reviewUrl = review?.url ? parseGitHubIssueOrPRLink(review.url) : null
  const legacyItem = worktree.linkedWorkItem
  const legacyNumberMatch =
    !legacyItem?.url &&
    legacyItem?.provider === 'github' &&
    legacyItem.type === link.type &&
    legacyItem.number === link.number &&
    repoMatchesGitHubSlug(repo, link.slug) !== false
  return (
    attachmentMatch || legacyNumberMatch || Boolean(reviewUrl && githubLinksEqual(reviewUrl, link))
  )
}
