import { useCallback } from 'react'
import type { ComposerTargetState } from '../composer-target-state-contract'
import type { GitHubWorkItem } from '../../../../../shared/github/work-items/work-item-types'
import {
  buildGiteaWorkspaceSource,
  shouldApplyWorkspaceSourceAutoName
} from '../../../../../shared/new-workspace/workspace-source'
import { getLinkedWorkItemWorkspaceName } from '../../../../../shared/workspace/naming/workspace-name'
import { getLinkedItemDisplayName } from '@/components/sidebar/workspace-creation/folder/folder-workspace-source-selection'

/** Gitea issues link as a work item only; they have no PR base to resolve and no legacy number slot. */
export function useGiteaProviderSelection(target: ComposerTargetState) {
  const { branchAutoNameRef, lastAutoNameRef, smartSourceSelectionRef } = target.asyncComposerState
  const { linkedWorkItem, name, setLinkedTaskSourceContext, setLinkedWorkItem, setName } =
    target.sourceContextState
  const {
    setBranchNameOverride,
    setBranchNameOverridePreservesNameEdits,
    setCompareBaseRef,
    setForkPushWarning,
    setLinkedGitLabIssue,
    setLinkedGitLabMR,
    setLinkedIssue,
    setLinkedPR,
    setStartFromResetHint
  } = target.workspaceIdentityState

  const handleSmartGiteaItemSelect = useCallback(
    (item: GitHubWorkItem): void => {
      smartSourceSelectionRef.current = null
      const linkedItem = buildGiteaWorkspaceSource({
        type: 'issue',
        number: item.number,
        title: item.title,
        url: item.url,
        repoId: item.repoId
      })
      setLinkedGitLabIssue(null)
      setLinkedGitLabMR(null)
      setLinkedIssue('')
      setLinkedPR(null)
      setLinkedTaskSourceContext(null)
      setLinkedWorkItem(linkedItem)
      const nextName =
        getLinkedWorkItemWorkspaceName(linkedItem)?.seedName ?? getLinkedItemDisplayName(linkedItem)
      if (
        nextName &&
        shouldApplyWorkspaceSourceAutoName({
          currentName: name,
          lastAutoName: lastAutoNameRef.current,
          lookupTextIsQuery: !linkedWorkItem
        })
      ) {
        setName(nextName)
        lastAutoNameRef.current = nextName
      }
      setStartFromResetHint(null)
      setBranchNameOverride(undefined)
      setBranchNameOverridePreservesNameEdits(false)
      setForkPushWarning(null)
      setCompareBaseRef(undefined)
      branchAutoNameRef.current = ''
    },
    [
      branchAutoNameRef,
      lastAutoNameRef,
      linkedWorkItem,
      name,
      setBranchNameOverride,
      setBranchNameOverridePreservesNameEdits,
      setCompareBaseRef,
      setForkPushWarning,
      setLinkedGitLabIssue,
      setLinkedGitLabMR,
      setLinkedIssue,
      setLinkedPR,
      setLinkedTaskSourceContext,
      setLinkedWorkItem,
      setName,
      setStartFromResetHint,
      smartSourceSelectionRef
    ]
  )

  return { handleSmartGiteaItemSelect }
}
