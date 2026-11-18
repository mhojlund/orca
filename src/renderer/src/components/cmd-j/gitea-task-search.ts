import { useAppStore } from '@/store'
import {
  getGitHubSourceTarget,
  getGitHubWorkItemRequestContext,
  listGitHubWorkItemsForRepo
} from '@/store/github/work-items/work-item-routing'
import { getRepoExecutionHostId } from '../../../../shared/execution-host/execution-host'
import type { Repo } from '../../../../shared/repository/repo-types'
import type { TaskSourceContext } from '../../../../shared/work-items/task-source-context'
import { makeCmdJTaskSearchResult, type CmdJTaskSearchResult } from './task-search-results'

export async function searchGiteaIssues({
  repo,
  source,
  query,
  hostLabel,
  resultLimit
}: {
  repo: Repo
  source: TaskSourceContext
  query: string
  hostLabel: string
  resultLimit: number
}): Promise<CmdJTaskSearchResult[]> {
  const state = useAppStore.getState()
  const context = getGitHubWorkItemRequestContext(
    state,
    getGitHubSourceTarget(state, repo, source),
    repo.id,
    repo.path,
    source
  )
  // Why: most repos are not Gitea; a failed probe there is not a search failure.
  const result = await listGitHubWorkItemsForRepo(context, {
    limit: resultLimit,
    query: `is:issue is:open ${query}`
  }).catch(() => null)
  if (!result || result.sources.ineligible) {
    return []
  }
  const repoHostId = getRepoExecutionHostId(repo)
  return result.items.map((issue) =>
    makeCmdJTaskSearchResult(
      { provider: 'gitea', issue: { ...issue, repoId: repo.id, repoHostId } },
      source,
      repo.id,
      hostLabel
    )
  )
}
