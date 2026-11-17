import type { ClassifiedError } from '../../../shared/errors/classified-error'
import { classifiedCodeHostError } from '../../../shared/source-control/code-host-failure-copy'
import { mapSettledWithConcurrency } from '../../../shared/concurrency/map-with-concurrency'
import type { ListWorkItemsResult } from '../../../shared/github/work-items/work-item-types'
import type { IssueSourcePreference } from '../../../shared/repository/repo-types'
import type { RemoteRefLocalGitOptions } from '../../git/remotes/remote-ref-probe-cache'
import type { GiteaRepoRef } from '../repository-ref'
import { giteaGet, repoApiPath, totalCountHeader } from './gitea-api'
import { classifyGiteaError } from './gitea-error-classification'
import {
  giteaIssueListParams,
  planGiteaQuery,
  planNeedsViewer,
  type GiteaListPlan
} from './gitea-task-query'
import { getGiteaViewerLogin, isGiteaRepoAuthenticated } from './gitea-viewer'
import {
  mapGiteaWorkItem,
  type MainGiteaWorkItem,
  type RawGiteaIssue,
  type RawGiteaPullDetail
} from './gitea-work-item-mappers'
import { resolveGiteaWorkItemSources, toOwnerRepo } from './gitea-work-item-source'

// Gitea caps pages at the server's MAX_RESPONSE_ITEMS (default 50).
const MAX_PAGE_LIMIT = 50
const PR_DETAIL_CONCURRENCY = 6

type KindPage = { items: MainGiteaWorkItem[]; total: number | null }

function clampLimit(limit: number | undefined): number {
  return Math.min(MAX_PAGE_LIMIT, Math.max(1, Math.floor(limit ?? 24)))
}

function clampPage(page: number | undefined): number {
  return typeof page === 'number' && Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1
}

function hasClientFilter(kind: 'issue' | 'pr', plan: GiteaListPlan): boolean {
  return kind === 'pr' && (plan.mergedOnly || plan.draftOnly || plan.reviewRequestedByViewer)
}

async function fetchRawPage(
  repo: GiteaRepoRef,
  kind: 'issue' | 'pr',
  plan: GiteaListPlan,
  viewer: string | null,
  limit: number,
  page: number,
  noCache: boolean
): Promise<{ raws: RawGiteaIssue[]; total: number | null }> {
  const params = giteaIssueListParams(plan, kind === 'pr' ? 'pulls' : 'issues', viewer)
  if (kind === 'pr' && plan.reviewRequestedByViewer) {
    // Review requests are only searchable across repos; narrow to this owner, then this repo.
    const { data } = await giteaGet<RawGiteaIssue[]>(
      repo,
      '/repos/issues/search',
      { ...params, review_requested: true, owner: repo.owner, page, limit },
      { noCache }
    )
    const fullName = `${repo.owner}/${repo.repo}`.toLowerCase()
    const raws = (data ?? []).filter((raw) => raw.repository?.full_name?.toLowerCase() === fullName)
    return { raws, total: null }
  }
  const { data, headers } = await giteaGet<RawGiteaIssue[]>(
    repo,
    repoApiPath(repo, '/issues'),
    { ...params, page, limit },
    { noCache }
  )
  return { raws: data ?? [], total: totalCountHeader(headers) }
}

async function withPullDetails(
  repo: GiteaRepoRef,
  raws: RawGiteaIssue[],
  noCache: boolean
): Promise<MainGiteaWorkItem[]> {
  const settled = await mapSettledWithConcurrency(raws, PR_DETAIL_CONCURRENCY, async (raw) => {
    const { data } = await giteaGet<RawGiteaPullDetail>(
      repo,
      repoApiPath(repo, `/pulls/${raw.number}`),
      undefined,
      { noCache }
    )
    return data
  })
  return raws
    .map((raw, index) => {
      const result = settled[index]
      // A failed detail read still lists the PR; only branch/SHA fields are missing.
      return mapGiteaWorkItem(raw, repo, result.status === 'fulfilled' ? result.value : null)
    })
    .filter((item): item is MainGiteaWorkItem => item !== null)
}

async function fetchKindPage(
  repo: GiteaRepoRef,
  kind: 'issue' | 'pr',
  plan: GiteaListPlan,
  viewer: string | null,
  limit: number,
  page: number,
  noCache: boolean
): Promise<KindPage> {
  const { raws, total } = await fetchRawPage(repo, kind, plan, viewer, limit, page, noCache)
  const items =
    kind === 'pr'
      ? await withPullDetails(repo, raws, noCache)
      : raws
          .map((raw) => mapGiteaWorkItem(raw, repo))
          .filter((item): item is MainGiteaWorkItem => item !== null && item.type === 'issue')
  const filtered = items.filter(
    (item) =>
      (!plan.mergedOnly || item.state === 'merged') && (!plan.draftOnly || item.state === 'draft')
  )
  return { items: filtered, total: hasClientFilter(kind, plan) ? null : total }
}

function kindsFor(plan: GiteaListPlan): ('issue' | 'pr')[] {
  return plan.scope === 'all' ? ['issue', 'pr'] : [plan.scope]
}

type KindRequest = {
  kind: 'issue' | 'pr'
  repo: GiteaRepoRef | null
}

async function runKinds(
  requests: KindRequest[],
  plan: GiteaListPlan,
  limit: number,
  page: number,
  noCache: boolean
): Promise<{
  pages: Partial<Record<'issue' | 'pr', KindPage>>
  errors: Partial<Record<'issue' | 'pr', ClassifiedError>>
}> {
  const pages: Partial<Record<'issue' | 'pr', KindPage>> = {}
  const errors: Partial<Record<'issue' | 'pr', ClassifiedError>> = {}
  await Promise.all(
    requests.map(async ({ kind, repo }) => {
      if (!repo) {
        return
      }
      const viewer = planNeedsViewer(plan) ? await getGiteaViewerLogin(repo) : null
      if (planNeedsViewer(plan) && !viewer) {
        errors[kind] = classifiedCodeHostError('permission_denied', 'gitea.authRequired')
        return
      }
      try {
        pages[kind] = await fetchKindPage(repo, kind, plan, viewer, limit, page, noCache)
      } catch (error) {
        errors[kind] = classifyGiteaError(error, await isGiteaRepoAuthenticated(repo))
      }
    })
  )
  return { pages, errors }
}

export async function listGiteaWorkItems(
  repoPath: string,
  limit?: number,
  query?: string,
  page?: number,
  preference?: IssueSourcePreference,
  connectionId?: string | null,
  noCache?: boolean,
  localGitOptions: RemoteRefLocalGitOptions = {}
): Promise<ListWorkItemsResult<MainGiteaWorkItem>> {
  const sources = await resolveGiteaWorkItemSources(
    repoPath,
    preference,
    connectionId,
    localGitOptions
  )
  const resultSources = {
    issues: toOwnerRepo(sources.issues),
    prs: toOwnerRepo(sources.prs),
    originCandidate: toOwnerRepo(sources.origin),
    upstreamCandidate: toOwnerRepo(sources.upstream),
    ...(sources.ineligible ? { ineligible: true as const } : {})
  }
  const plan = planGiteaQuery(query)
  const requests = kindsFor(plan).map((kind) => ({
    kind,
    repo: kind === 'pr' ? sources.prs : sources.issues
  }))
  const { pages, errors } = await runKinds(
    requests,
    plan,
    clampLimit(limit),
    clampPage(page),
    noCache === true
  )
  if (plan.unsupported.length > 0) {
    for (const kind of kindsFor(plan)) {
      errors[kind] ??= classifiedCodeHostError(
        'validation_error',
        'gitea.unsupportedQualifier',
        plan.unsupported.join(' ')
      )
    }
  }
  const items = [...(pages.issue?.items ?? []), ...(pages.pr?.items ?? [])]
    .sort((a, b) => b.number - a.number)
    .slice(0, clampLimit(limit) * kindsFor(plan).length)
  return {
    items,
    sources: resultSources,
    ...(errors.issue || errors.pr
      ? {
          errors: {
            ...(errors.issue ? { issues: errors.issue } : {}),
            ...(errors.pr ? { prs: errors.pr } : {})
          }
        }
      : {}),
    ...(sources.issueSourceFellBack ? { issueSourceFellBack: true as const } : {})
  }
}

/** Server totals from X-Total-Count; client-filtered PR views count the first page as a lower bound. */
export async function countGiteaWorkItems(
  repoPath: string,
  query?: string,
  preference?: IssueSourcePreference,
  connectionId?: string | null,
  localGitOptions: RemoteRefLocalGitOptions = {}
): Promise<number> {
  const sources = await resolveGiteaWorkItemSources(
    repoPath,
    preference,
    connectionId,
    localGitOptions
  )
  const plan = planGiteaQuery(query)
  const requests = kindsFor(plan).map((kind) => ({
    kind,
    repo: kind === 'pr' ? sources.prs : sources.issues
  }))
  const counts = await Promise.all(
    requests.map(async ({ kind }) => {
      const pageLimit = hasClientFilter(kind, plan) ? MAX_PAGE_LIMIT : 1
      const { pages } = await runKinds(
        requests.filter((request) => request.kind === kind),
        plan,
        pageLimit,
        1,
        false
      )
      const result = pages[kind]
      return result ? (result.total ?? result.items.length) : 0
    })
  )
  return counts.reduce((sum, count) => sum + count, 0)
}
