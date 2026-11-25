import { useEffect, useEffectEvent } from 'react'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import type { ComposerTargetState } from '../composer-target-state-contract'
import { getWorkspaceSourceProvider } from '../../../../../shared/new-workspace/workspace-source'
import { resolveGiteaPrStartPointForRepo } from '@/lib/source-control/review/gitea-pr-start-point'
import { runtimeTargetForRepoOwner } from '@/lib/workspace/ownership/repo-runtime-owner'

/** Starts a workspace from a linked Gitea PR's head, so pushes update that PR. */
export function useGiteaPrStartPoint(target: ComposerTargetState): void {
  const { linkedWorkItem, setNote } = target.sourceContextState
  const { setBaseBranch, setBaseBranchNamesWorkspace, setCompareBaseRef, setPushTarget } =
    target.workspaceIdentityState
  const { lastAutoNoteRef, noteRef } = target.asyncComposerState
  const selectedRepo = target.runtimeTargetSelection.selectedRepo
  const prNumber =
    linkedWorkItem &&
    getWorkspaceSourceProvider(linkedWorkItem) === 'gitea' &&
    linkedWorkItem.type === 'pr'
      ? linkedWorkItem.number
      : null
  const prTitle = linkedWorkItem?.title ?? ''
  const repoId = selectedRepo?.id ?? null

  // Why: only a new PR or repo re-resolves; the selected repo object changes identity on unrelated store updates.
  const resolveStartPoint = useEffectEvent(() => {
    if (prNumber === null || !selectedRepo || !repoId) {
      return undefined
    }
    let stale = false
    resolveGiteaPrStartPointForRepo({
      repoId,
      prNumber,
      target: runtimeTargetForRepoOwner({ repos: [selectedRepo] }, repoId)
    })
      .then((startPoint) => {
        if (stale) {
          return
        }
        setBaseBranch(startPoint.baseBranch)
        setBaseBranchNamesWorkspace(true)
        setCompareBaseRef(startPoint.compareBaseRef)
        setPushTarget(startPoint.pushTarget)
        // Replace notes only while empty or still auto-filled; preserve user instructions.
        const suggestedNote = `PR #${prNumber} — ${prTitle}`
        if (!noteRef.current.trim() || noteRef.current === lastAutoNoteRef.current) {
          setNote(suggestedNote)
          lastAutoNoteRef.current = suggestedNote
        }
      })
      .catch((error: unknown) => {
        if (stale) {
          return
        }
        setBaseBranch(undefined)
        setCompareBaseRef(undefined)
        setPushTarget(undefined)
        toast.error(
          error instanceof Error
            ? error.message
            : translate(
                'auto.hooks.useComposerState.giteaPrBaseFailed',
                'Failed to resolve PR base.'
              )
        )
      })
    return () => {
      stale = true
    }
  })

  useEffect(() => resolveStartPoint(), [prNumber, repoId])
}
