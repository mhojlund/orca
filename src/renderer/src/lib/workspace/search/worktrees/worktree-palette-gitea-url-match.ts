import {
  parseGiteaIssueOrPRLink,
  type GiteaIssueOrPRLink
} from '../../../../../../shared/gitea/gitea-links'
import type { HostedReviewInfo } from '../../../../../../shared/source-control/hosted-review/hosted-review-contracts'
import { getWorkspaceAttachments } from '../../../../../../shared/workspace-attachments/workspace-attachments'
import type { CmdJTaskUrlCreatePreview } from './worktree-palette-task-url-match'
import type { PaletteSearchResult } from './worktree-palette-search'
import type { getPaletteWorktreeExecutionHostId } from '../palette-repo-resolution'
import { buildWorktreePaletteTaskUrlResult } from './worktree-palette-task-url-result'
import type { Worktree } from '../../../../../../shared/worktree/types'

function giteaLinksEqual(left: GiteaIssueOrPRLink, right: GiteaIssueOrPRLink): boolean {
  return (
    left.type === right.type &&
    left.number === right.number &&
    left.slug.host === right.slug.host &&
    left.slug.owner.toLowerCase() === right.slug.owner.toLowerCase() &&
    left.slug.repo.toLowerCase() === right.slug.repo.toLowerCase()
  )
}

export function worktreeMatchesGiteaUrl(
  worktree: Worktree,
  link: GiteaIssueOrPRLink,
  review: HostedReviewInfo | null | undefined
): boolean {
  // Why: the link already proved its host is Gitea, so attachment/review URLs are parsed leniently.
  const hosts = new Set([link.slug.host])
  const parse = (url: string | null | undefined) =>
    url ? parseGiteaIssueOrPRLink(url, hosts) : null
  const attachmentMatch = getWorkspaceAttachments(worktree).some((item) => {
    if (item.provider !== 'gitea') {
      return false
    }
    const itemUrl = parse(item.url)
    return itemUrl !== null && giteaLinksEqual(itemUrl, link)
  })
  const reviewUrl = parse(review?.url)
  return attachmentMatch || Boolean(reviewUrl && giteaLinksEqual(reviewUrl, link))
}

export function getGiteaTaskUrlCreatePreview(link: GiteaIssueOrPRLink): CmdJTaskUrlCreatePreview {
  const { slug, number, type } = link
  const repo = `${slug.host}/${slug.owner}/${slug.repo}`
  const kindLabel = type === 'pr' ? 'Gitea pull request' : 'Gitea issue'
  return {
    provider: 'gitea',
    identifier: `#${number}`,
    subtitle: repo,
    kindLabel,
    createLabel: `Create worktree from ${kindLabel} ${repo}#${number}`
  }
}

export function matchGiteaPaletteTaskUrl(args: {
  worktree: Worktree
  link: GiteaIssueOrPRLink
  review?: HostedReviewInfo | null
  worktreeHostId: ReturnType<typeof getPaletteWorktreeExecutionHostId>
}): PaletteSearchResult | null {
  const { worktree, link, review, worktreeHostId } = args
  if (!worktreeMatchesGiteaUrl(worktree, link, review)) {
    return null
  }
  return buildWorktreePaletteTaskUrlResult({
    worktreeId: worktree.id,
    ...(worktreeHostId ? { worktreeHostId } : {}),
    labelKind: link.type === 'pr' ? 'pr' : 'issue',
    text: `${link.type === 'pr' ? 'PR' : 'Issue'} #${link.number}`
  })
}
