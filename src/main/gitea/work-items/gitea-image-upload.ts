import { assertGitHubImage } from '../../../shared/github/attachments/image-attachment'
import type { IssueSourcePreference } from '../../../shared/repository/repo-types'
import type { RemoteRefLocalGitOptions } from '../../git/remotes/remote-ref-probe-cache'
import { giteaUpload, repoApiPath } from './gitea-api'
import { resolveGiteaItemRepo } from './gitea-work-item-source'

/**
 * Gitea stores images as assets of an existing issue, so new issues upload after creation.
 * Same type/size limits as GitHub uploads.
 */
export async function uploadGiteaIssueImage(args: {
  repoPath: string
  issueNumber: number
  fileName: string
  contentType: string
  bytes: Buffer
  preference?: IssueSourcePreference
  connectionId?: string | null
  localGitOptions?: RemoteRefLocalGitOptions
}): Promise<{ url: string }> {
  assertGitHubImage(args.contentType, args.bytes.byteLength)
  const repo = await resolveGiteaItemRepo(
    args.repoPath,
    'issue',
    args.preference,
    args.connectionId,
    args.localGitOptions ?? {}
  )
  if (!repo) {
    throw new Error('Could not resolve the Gitea/Forgejo repository for this checkout.')
  }
  const form = new FormData()
  form.append(
    'attachment',
    new Blob([new Uint8Array(args.bytes)], { type: args.contentType }),
    args.fileName
  )
  const asset = await giteaUpload<{ browser_download_url?: string }>(
    repo,
    repoApiPath(repo, `/issues/${args.issueNumber}/assets`),
    form
  )
  if (!asset?.browser_download_url) {
    throw new Error('Gitea/Forgejo did not return an attachment URL.')
  }
  return { url: asset.browser_download_url }
}
