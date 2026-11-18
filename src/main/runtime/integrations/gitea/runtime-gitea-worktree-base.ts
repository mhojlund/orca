import type { Repo } from '../../../../shared/repository/repo-types'
import { isFolderRepo } from '../../../../shared/repository/repo-kind'
import { reviewStartPointFailure } from '../../../../shared/worktree/hosted-review/review-start-point-failure-copy'
import { getRepoRoutingConnectionId } from '../../../../shared/execution-host/execution-host'
import { requireRepoLocalGitRoute } from '../../../workspaces/execution-host/repo-execution-host'
import {
  getLocalProjectGitExecOptions,
  getLocalProjectWorktreeGitOptions
} from '../../../workspaces/execution-host/project-runtime-git-options'
import type { ProjectRuntimeResolutionStore } from '../../../workspaces/execution-host/local-project-runtime-resolution'
import { resolvePrStartPointUnlessWslStopped } from '../../../github/pull-requests/start-points/pr-start-point-wsl-gate'
import {
  resolveGiteaPrStartPoint,
  type GiteaPrStartPoint
} from '../../../gitea/pull-requests/gitea-pr-start-point'

export type RuntimeGiteaWorktreeBaseArgs = {
  repoSelector: string
  prNumber: number
  /** The user creating from the PR: it may start a stopped WSL distro. */
  wakeWslDistro?: boolean
}

export async function resolveRuntimeGiteaWorktreeBase(
  args: RuntimeGiteaWorktreeBaseArgs,
  deps: {
    store: ProjectRuntimeResolutionStore | null
    resolveRepo: (selector: string) => Promise<Repo>
  }
): Promise<GiteaPrStartPoint | { error: string }> {
  if (!deps.store) {
    throw new Error('runtime_unavailable')
  }
  let repo: Repo
  try {
    repo = await deps.resolveRepo(args.repoSelector)
  } catch {
    return reviewStartPointFailure('repoNotFound')
  }
  if (isFolderRepo(repo)) {
    return reviewStartPointFailure('folderUnsupported')
  }
  requireRepoLocalGitRoute(repo)
  const localGitExecOptions = getLocalProjectGitExecOptions(deps.store, repo)
  const localGitOptions = getLocalProjectWorktreeGitOptions(deps.store, repo)
  return resolvePrStartPointUnlessWslStopped(
    { path: repo.path, wslDistro: localGitExecOptions.wslDistro },
    { wakeWslDistro: args.wakeWslDistro },
    () =>
      resolveGiteaPrStartPoint({
        repo,
        prNumber: args.prNumber,
        connectionId: getRepoRoutingConnectionId(repo) ?? null,
        localGitExecOptions,
        localGitOptions
      })
  )
}
