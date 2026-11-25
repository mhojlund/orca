import type { GitPushTarget } from '../../../shared/worktree/types'
import type { Repo } from '../../../shared/repository/repo-types'
import { reviewStartPointFailure } from '../../../shared/worktree/hosted-review/review-start-point-failure-copy'
import { REVIEW_HEAD_FETCH_TIMEOUT_MS } from '../../../shared/worktree/hosted-review/review-head-tracking-ref'
import { isTransientReviewHeadFetchError } from '../../git/remotes/fetch-error-classification'
import { fetchCompareBaseRefWithLocalFallback } from '../../git/remotes/compare-base-ref-fetch'
import type { RemoteRefLocalGitOptions } from '../../git/remotes/remote-ref-probe-cache'
import { gitExecFileAsync } from '../../git/command-runner/git-exec-file'
import {
  fetchGitHubPullRequestHeadRef,
  fetchPrHeadTrackingRef
} from '../../github/pull-requests/start-points/pr-head-tracking-ref'
import { getGiteaRepoRefForRemote, type GiteaRepoRef } from '../repository-ref'
import { giteaGet, repoApiPath } from '../work-items/gitea-api'
import type { RawGiteaPullDetail } from '../work-items/gitea-work-item-mappers'
import { resolveGiteaWorkItemSources } from '../work-items/gitea-work-item-source'

export type GiteaPrStartPoint = {
  baseBranch: string
  compareBaseRef?: string
  pushTarget?: GitPushTarget
}

type LocalGitExecOptions = { cwd: string; wslDistro?: string }

function sameRepoRef(a: GiteaRepoRef, b: GiteaRepoRef): boolean {
  return (
    a.host === b.host &&
    a.owner.toLowerCase() === b.owner.toLowerCase() &&
    a.repo.toLowerCase() === b.repo.toLowerCase()
  )
}

/** The remote hosting the PR: upstream when it is the Gitea source, else origin. */
async function remoteNameFor(
  repoPath: string,
  prRepo: GiteaRepoRef,
  connectionId: string | null,
  localGitOptions: RemoteRefLocalGitOptions
): Promise<string | null> {
  for (const name of ['upstream', 'origin']) {
    const ref = await getGiteaRepoRefForRemote(repoPath, name, connectionId, localGitOptions)
    if (ref && sameRepoRef(ref, prRepo)) {
      return name
    }
  }
  return null
}

export async function resolveGiteaPrStartPoint(args: {
  repo: Pick<Repo, 'path' | 'issueSourcePreference' | 'connectionId' | 'executionHostId'>
  prNumber: number
  connectionId: string | null
  localGitExecOptions: LocalGitExecOptions
  localGitOptions: RemoteRefLocalGitOptions
}): Promise<GiteaPrStartPoint | { error: string }> {
  const { repo, prNumber, localGitExecOptions } = args
  const sources = await resolveGiteaWorkItemSources(
    repo.path,
    repo.issueSourcePreference,
    args.connectionId,
    args.localGitOptions
  )
  const prRepo = sources.prs
  const remote = prRepo
    ? await remoteNameFor(repo.path, prRepo, args.connectionId, args.localGitOptions)
    : null
  if (!prRepo || !remote) {
    return reviewStartPointFailure('gitea.remoteNotFound')
  }
  let pull: RawGiteaPullDetail | null
  try {
    pull = (
      await giteaGet<RawGiteaPullDetail>(
        prRepo,
        repoApiPath(prRepo, `/pulls/${prNumber}`),
        undefined,
        {
          noCache: true
        }
      )
    ).data
  } catch {
    return reviewStartPointFailure('gitea.prNotFound', { number: prNumber })
  }
  const headBranch = pull?.head?.ref?.trim() ?? ''
  const baseBranch = pull?.base?.ref?.trim() ?? ''
  if (!pull || !headBranch) {
    return reviewStartPointFailure('gitea.prHeadBranchMissing', { number: prNumber })
  }
  const headRepoName = pull.head?.repo?.full_name?.toLowerCase()
  const isFork = headRepoName !== `${prRepo.owner}/${prRepo.repo}`.toLowerCase()
  const gitExec = (gitArgs: string[]) => gitExecFileAsync(gitArgs, localGitExecOptions)
  const compareBaseRef = baseBranch ? `refs/remotes/${remote}/${baseBranch}` : undefined
  const fetchCompareBase = (): Promise<boolean> =>
    fetchCompareBaseRefWithLocalFallback({
      compareBaseRef,
      fetchCompareBaseRef: async (ref) => {
        await gitExecFileAsync(['fetch', remote, `+refs/heads/${baseBranch}:${ref}`], {
          ...localGitExecOptions,
          timeout: REVIEW_HEAD_FETCH_TIMEOUT_MS
        })
      },
      gitExec,
      logLabel: '[gitea:resolvePrStartPoint]',
      logContext: { remote, baseBranch, prNumber }
    })
  const withCompareBase = async (start: GiteaPrStartPoint): Promise<GiteaPrStartPoint> =>
    (await fetchCompareBase()) && compareBaseRef ? { ...start, compareBaseRef } : start

  const fetchHeadCommit = async (): Promise<GiteaPrStartPoint | { error: string }> => {
    // Closed and fork PRs may have no reachable branch, but the server keeps refs/pull/N/head.
    try {
      const localRef = await fetchGitHubPullRequestHeadRef(repo, remote, prNumber, {
        localGitExecOptions
      })
      const { stdout } = await gitExec(['rev-parse', '--verify', `${localRef}^{commit}`])
      const sha = stdout.trim()
      return sha
        ? await withCompareBase({ baseBranch: sha })
        : reviewStartPointFailure('gitea.forkHeadUnresolved', { number: prNumber })
    } catch (error) {
      const detail = (error instanceof Error ? error.message : String(error)).split('\n')[0]
      return reviewStartPointFailure('fetchFailed', {
        ref: `refs/pull/${prNumber}/head`,
        detail: isTransientReviewHeadFetchError(error) ? `${detail} (retry)` : detail
      })
    }
  }

  if (isFork) {
    return fetchHeadCommit()
  }
  const remoteRef = `${remote}/${headBranch}`
  try {
    await fetchPrHeadTrackingRef(repo, remote, headBranch, { localGitExecOptions })
    await gitExec(['rev-parse', '--verify', remoteRef])
  } catch {
    return fetchHeadCommit()
  }
  return withCompareBase({
    baseBranch: remoteRef,
    pushTarget: { remoteName: remote, branchName: headBranch }
  })
}
