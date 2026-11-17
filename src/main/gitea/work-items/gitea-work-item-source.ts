import type { IssueSourcePreference } from '../../../shared/repo-types'
import type { GitHubOwnerRepo } from '../../../shared/github/pull-request-types'
import type { RemoteRefLocalGitOptions } from '../../git/remotes/remote-ref-probe-cache'
import { getGiteaRepoRefForRemote, type GiteaRepoRef } from '../repository-ref'
import { isGiteaHost } from './gitea-host-eligibility'

export type GiteaWorkItemSources = {
  issues: GiteaRepoRef | null
  prs: GiteaRepoRef | null
  origin: GiteaRepoRef | null
  upstream: GiteaRepoRef | null
  /** Upstream was requested but missing, so origin was used. */
  issueSourceFellBack: boolean
  /** A remote exists but its host is not Gitea/Forgejo. */
  ineligible: boolean
}

export function toOwnerRepo(ref: GiteaRepoRef | null): GitHubOwnerRepo | null {
  return ref ? { owner: ref.owner, repo: ref.repo, host: ref.host } : null
}

async function eligibleRemote(
  repoPath: string,
  remoteName: string,
  connectionId: string | null | undefined,
  localGitOptions: RemoteRefLocalGitOptions
): Promise<{ ref: GiteaRepoRef | null; parsedButIneligible: boolean }> {
  const ref = await getGiteaRepoRefForRemote(repoPath, remoteName, connectionId, localGitOptions)
  if (!ref) {
    return { ref: null, parsedButIneligible: false }
  }
  return (await isGiteaHost(ref))
    ? { ref, parsedButIneligible: false }
    : { ref: null, parsedButIneligible: true }
}

/** Mirrors GitHub's upstream/origin issue-source selection; PRs target the upstream when present. */
export async function resolveGiteaWorkItemSources(
  repoPath: string,
  preference: IssueSourcePreference | undefined,
  connectionId: string | null | undefined,
  localGitOptions: RemoteRefLocalGitOptions = {}
): Promise<GiteaWorkItemSources> {
  const [origin, upstream] = await Promise.all([
    eligibleRemote(repoPath, 'origin', connectionId, localGitOptions),
    eligibleRemote(repoPath, 'upstream', connectionId, localGitOptions)
  ])
  const requested = preference ?? 'auto'
  const issues =
    requested === 'origin'
      ? origin.ref
      : requested === 'upstream'
        ? (upstream.ref ?? origin.ref)
        : (upstream.ref ?? origin.ref)
  return {
    issues,
    prs: upstream.ref ?? origin.ref,
    origin: origin.ref,
    upstream: upstream.ref,
    issueSourceFellBack: requested === 'upstream' && !upstream.ref && origin.ref !== null,
    ineligible:
      !origin.ref && !upstream.ref && (origin.parsedButIneligible || upstream.parsedButIneligible)
  }
}

/** Single-item reads use the issue source for issues and the PR source for PRs. */
export async function resolveGiteaItemRepo(
  repoPath: string,
  type: 'issue' | 'pr',
  preference: IssueSourcePreference | undefined,
  connectionId: string | null | undefined,
  localGitOptions: RemoteRefLocalGitOptions = {}
): Promise<GiteaRepoRef | null> {
  const sources = await resolveGiteaWorkItemSources(
    repoPath,
    preference,
    connectionId,
    localGitOptions
  )
  return type === 'pr' ? sources.prs : sources.issues
}
