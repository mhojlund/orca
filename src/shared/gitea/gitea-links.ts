import { isWorkItemLinkQueryTooLarge } from '../new-workspace/work-item-link-query-bounds'

const GITEA_ITEM_PATH_RE = /^\/([^/]+)\/([^/]+)\/(issues|pulls)\/(\d+)(?:\/.*)?$/i

export type GiteaIssueOrPRLink = {
  slug: { host: string; owner: string; repo: string }
  number: number
  type: 'issue' | 'pr'
}

/**
 * `/pulls/N` is Gitea-only, but `/issues/N` is shared with GitHub Enterprise, so issue links
 * count only on hosts the user has connected as a Gitea/Forgejo instance.
 */
export function parseGiteaIssueOrPRLink(
  input: string,
  knownHosts: ReadonlySet<string>
): GiteaIssueOrPRLink | null {
  const trimmed = input.trim()
  if (!trimmed || isWorkItemLinkQueryTooLarge(trimmed)) {
    return null
  }
  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return null
  }
  const match = GITEA_ITEM_PATH_RE.exec(url.pathname)
  if (!match) {
    return null
  }
  const type = match[3].toLowerCase() === 'pulls' ? 'pr' : 'issue'
  const host = url.host.toLowerCase()
  if (type === 'issue' && !knownHosts.has(host)) {
    return null
  }
  const number = Number.parseInt(match[4], 10)
  if (!Number.isSafeInteger(number) || number <= 0) {
    return null
  }
  return { slug: { host, owner: match[1], repo: match[2] }, number, type }
}
