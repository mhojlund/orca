import { useEffect, useMemo } from 'react'
import { buildTaskSourceContextFromRepo } from '../../../../../shared/work-items/task-source-context'
import { getRepoExecutionHostId } from '../../../../../shared/execution-host/execution-host'
import type { GitHubWorkItem } from '../../../../../shared/github/work-items/work-item-types'
import { RESULT_LIMIT } from '../name-field/smart-workspace-name-field-model'
import {
  getGitHubSourceTarget,
  getGitHubWorkItemRequestContext,
  listGitHubWorkItemsForRepo
} from '@/store/github/work-items/work-item-routing'
import { useAppStore } from '@/store'
import type { useWorkItemSourceFoundation } from './use-work-item-source-foundation'

export function useGiteaSourceContext(selectedRepo: Foundation['selectedRepo']) {
  return useMemo(
    () =>
      selectedRepo
        ? buildTaskSourceContextFromRepo({
            provider: 'gitea',
            projectId: selectedRepo.id,
            repo: selectedRepo
          })
        : null,
    [selectedRepo]
  )
}

type Foundation = ReturnType<typeof useWorkItemSourceFoundation>

export function useSmartWorkspaceGiteaSearch({
  foundation,
  shouldQueryGitea
}: {
  foundation: Foundation
  shouldQueryGitea: boolean
}): void {
  const { debouncedQuery, repoBackedSearchTargets, setGiteaItems, setGiteaLoading } = foundation

  useEffect(() => {
    if (!shouldQueryGitea || repoBackedSearchTargets.length === 0) {
      setGiteaItems([])
      setGiteaLoading(false)
      return
    }
    let stale = false
    setGiteaLoading(true)
    const text = debouncedQuery.trim()
    const query = ['is:issue is:open', text].filter(Boolean).join(' ')
    // Why: an empty-query list must not briefly paint the previous non-empty result set.
    if (!text) {
      setGiteaItems([])
    }
    void Promise.all(
      repoBackedSearchTargets.map(async (target) => {
        const state = useAppStore.getState()
        const source = target.giteaSourceContext
        const context = getGitHubWorkItemRequestContext(
          state,
          getGitHubSourceTarget(state, target.repo, source),
          target.repo.id,
          target.repo.path,
          source
        )
        const result = await listGitHubWorkItemsForRepo(context, {
          limit: RESULT_LIMIT,
          query
        }).catch(() => null)
        if (!result || result.sources.ineligible) {
          return []
        }
        const repoHostId = getRepoExecutionHostId(target.repo)
        return result.items.map((item) => ({ ...item, repoId: target.repo.id, repoHostId }))
      })
    )
      .then((groups) => {
        if (stale) {
          return
        }
        const items: GitHubWorkItem[] = groups.flat()
        setGiteaItems(
          items
            .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
            .slice(0, RESULT_LIMIT)
        )
      })
      .finally(() => {
        if (!stale) {
          setGiteaLoading(false)
        }
      })
    return () => {
      stale = true
    }
  }, [debouncedQuery, repoBackedSearchTargets, setGiteaItems, setGiteaLoading, shouldQueryGitea])
}
