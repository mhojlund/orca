import { callRuntimeRpc } from '@/runtime/rpc/calls/runtime-rpc-call'
import type { RuntimeClientTarget } from '../../../../../shared/remote-runtime/host-catalog/runtime-client-target'
import type { GitPushTarget } from '../../../../../shared/worktree/types'
import type { ReviewStartPointFailure } from '../../../../../shared/worktree/hosted-review/review-start-point-failure-copy'
import { reviewStartPointErrorText } from '@/lib/source-control/remote/code-host-error-copy'

export type GiteaPrStartPoint = {
  baseBranch: string
  compareBaseRef?: string
  pushTarget?: GitPushTarget
}

export async function resolveGiteaPrStartPointForRepo(args: {
  repoId: string
  prNumber: number
  /** The repo owner's transport; `null` (no routable owner) is refused. */
  target: RuntimeClientTarget | null
}): Promise<GiteaPrStartPoint> {
  if (!args.target) {
    throw new Error('The project host is unresolved. Refresh the project and retry.')
  }
  // Picking a PR to create from is a user act: it may start the repo's stopped WSL distro.
  const result =
    args.target.kind === 'local'
      ? await window.api.worktrees.resolveGiteaPrBase({
          repoId: args.repoId,
          prNumber: args.prNumber,
          wakeWslDistro: true
        })
      : await callRuntimeRpc<GiteaPrStartPoint | ReviewStartPointFailure>(
          args.target,
          'worktree.resolveGiteaPrBase',
          { repo: args.repoId, prNumber: args.prNumber, wakeWslDistro: true },
          { timeoutMs: 30_000 }
        )
  if ('error' in result) {
    throw new Error(reviewStartPointErrorText(result))
  }
  return result
}
