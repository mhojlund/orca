import { useEffect } from 'react'
import type { TaskPageProviderMetadataModel } from '../use-task-page-provider-metadata'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { readIpcErrorDetail } from '@/runtime/errors/ipc-error'
import { getTaskPageRepoSourceContext } from '@/lib/work-items/task-repo-source-context'
import {
  getGitHubSourceTarget,
  getGitHubWorkItemRequestContext,
  listGitHubWorkItemsForRepo
} from '@/store/github/work-items/work-item-routing'
import { mapSettledWithConcurrency } from '../../../../../shared/concurrency/map-with-concurrency'
import { getRepoExecutionHostId } from '../../../../../shared/execution-host/execution-host'
import type { GitHubWorkItem } from '../../../../../shared/github/work-items/work-item-types'
import type { Repo } from '../../../../../shared/repository/repo-types'
import { giteaIssueQuery } from './gitea-task-filters'

const GITEA_TASK_FETCH_CONCURRENCY = 6
const GITEA_ISSUE_PAGE_LIMIT = 50
// Each PR row costs a detail request, so PR pages stay smaller.
const GITEA_PR_PAGE_LIMIT = 25

type GiteaLoadingInput = Pick<
  TaskPageProviderMetadataModel,
  | 'selectedRepos'
  | 'selectedReposKey'
  | 'taskSource'
  | 'giteaKind'
  | 'giteaState'
  | 'giteaInvolvement'
  | 'giteaItems'
  | 'giteaListQueryKey'
  | 'giteaLoading'
  | 'giteaError'
  | 'giteaAuthRequired'
  | 'giteaRefreshNonce'
  | 'setGiteaItems'
  | 'setGiteaListQueryKey'
  | 'setGiteaLoading'
  | 'setGiteaError'
  | 'setGiteaAuthRequired'
>

async function listRepoIssues(
  repo: Repo,
  query: string,
  limit: number
): Promise<{ items: GitHubWorkItem[]; authRequired: boolean; error: string | null }> {
  const sourceContext = getTaskPageRepoSourceContext(repo, 'gitea')
  const state = useAppStore.getState()
  const context = getGitHubWorkItemRequestContext(
    state,
    getGitHubSourceTarget(state, repo, sourceContext),
    repo.id,
    repo.path,
    sourceContext
  )
  const result = await listGitHubWorkItemsForRepo(context, { limit, query })
  // Non-Gitea repos in a mixed selection are skipped rather than reported as failures.
  if (result.sources.ineligible) {
    return { items: [], authRequired: false, error: null }
  }
  const repoHostId = getRepoExecutionHostId(repo)
  const failure = result.errors?.issues
  return {
    items: result.items.map((item) => ({ ...item, repoId: repo.id, repoHostId })),
    authRequired: failure?.type === 'permission_denied',
    error: failure?.message ?? null
  }
}

export function useTaskPageGiteaLoading<Model extends GiteaLoadingInput>(model: Model): Model {
  const {
    selectedRepos,
    selectedReposKey,
    taskSource,
    giteaKind,
    giteaState,
    giteaInvolvement,
    giteaRefreshNonce,
    giteaListQueryKey,
    setGiteaItems,
    setGiteaListQueryKey,
    setGiteaLoading,
    setGiteaError,
    setGiteaAuthRequired
  } = model
  const queryKey = JSON.stringify([giteaKind, giteaState, giteaInvolvement, selectedReposKey])

  useEffect(() => {
    if (taskSource !== 'gitea') {
      return
    }
    let stale = false
    setGiteaLoading(true)
    setGiteaError(null)
    setGiteaAuthRequired(false)
    const query = giteaIssueQuery(giteaKind, giteaState, giteaInvolvement)
    const limit = giteaKind === 'prs' ? GITEA_PR_PAGE_LIMIT : GITEA_ISSUE_PAGE_LIMIT
    void mapSettledWithConcurrency(selectedRepos, GITEA_TASK_FETCH_CONCURRENCY, (repo) =>
      // Why: a stale selection's results are discarded below, so skip repos not yet started.
      stale
        ? Promise.resolve({ items: [], authRequired: false, error: null })
        : listRepoIssues(repo, query, limit)
    )
      .then((results) => {
        if (stale) {
          return
        }
        const merged: GitHubWorkItem[] = []
        const errors: string[] = []
        let needsAuth = false
        for (const result of results) {
          if (result.status !== 'fulfilled') {
            errors.push(
              readIpcErrorDetail(result.reason) ??
                translate(
                  'auto.components.TaskPage.giteaLoadFailed',
                  'Could not load Gitea issues. Refresh to try again.'
                )
            )
            continue
          }
          merged.push(...result.value.items)
          needsAuth = needsAuth || result.value.authRequired
          if (result.value.error) {
            errors.push(result.value.error)
          }
        }
        merged.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        setGiteaItems(merged)
        setGiteaListQueryKey(queryKey)
        // Show failures only when no usable rows remain; mixed selections may include non-Gitea repos.
        if (merged.length === 0 && errors.length > 0) {
          setGiteaError(errors[0])
          setGiteaAuthRequired(needsAuth)
        }
      })
      .finally(() => {
        if (!stale) {
          setGiteaLoading(false)
        }
      })
    return () => {
      stale = true
    }
  }, [
    taskSource,
    selectedRepos,
    giteaKind,
    giteaState,
    giteaInvolvement,
    giteaRefreshNonce,
    queryKey,
    setGiteaItems,
    setGiteaListQueryKey,
    setGiteaLoading,
    setGiteaError,
    setGiteaAuthRequired
  ])

  // Rows belong to the query that loaded them, so a changed filter never shows the previous filter's rows.
  return giteaListQueryKey === queryKey
    ? model
    : Object.assign(model, {
        giteaItems: [],
        giteaError: null,
        giteaAuthRequired: false,
        giteaLoading: true
      })
}
