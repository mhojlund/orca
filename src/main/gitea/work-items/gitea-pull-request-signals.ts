import type {
  GitHubPRReviewSummary,
  PRReviewDecision,
  ProviderCheckSummary
} from '../../../shared/github/pull-requests/pull-request-types'
import { resolveProviderCheckState } from '../../../shared/source-control/checks/provider-check-summary'
import type { GiteaRepoRef } from '../repository-ref'
import { giteaGet, repoApiPath } from './gitea-api'
import {
  giteaLogin,
  mapGiteaUser,
  type MainGiteaWorkItem,
  type RawGiteaPullDetail,
  type RawGiteaUser
} from './gitea-work-item-mappers'

type RawGiteaReview = {
  state?: string | null
  dismissed?: boolean | null
  stale?: boolean | null
  user?: RawGiteaUser | null
}

type RawGiteaCombinedStatusResponse = {
  statuses?: { status?: string | null; state?: string | null }[] | null
}

export type GiteaPullSignals = Pick<
  MainGiteaWorkItem,
  'reviewRequests' | 'reviewDecision' | 'latestReviews' | 'checksSummary'
>

const REVIEW_STATE_BY_GITEA: Record<string, string> = {
  APPROVED: 'APPROVED',
  REQUEST_CHANGES: 'CHANGES_REQUESTED'
}

/** Newest decisive review per reviewer; comments and pending drafts never decide a PR. */
function latestDecisiveReviews(raws: RawGiteaReview[]): GitHubPRReviewSummary[] {
  const byLogin = new Map<string, GitHubPRReviewSummary>()
  for (const raw of raws) {
    const login = giteaLogin(raw.user)
    const state = REVIEW_STATE_BY_GITEA[(raw.state ?? '').toUpperCase()]
    if (!login || !state || raw.dismissed) {
      continue
    }
    byLogin.set(login.toLowerCase(), {
      login,
      state,
      ...(raw.user?.avatar_url ? { avatarUrl: raw.user.avatar_url } : {})
    })
  }
  return [...byLogin.values()]
}

function reviewDecisionFor(
  reviews: GitHubPRReviewSummary[],
  hasRequests: boolean
): PRReviewDecision | null {
  if (reviews.some((review) => review.state === 'CHANGES_REQUESTED')) {
    return 'CHANGES_REQUESTED'
  }
  if (reviews.some((review) => review.state === 'APPROVED')) {
    return 'APPROVED'
  }
  return hasRequests ? 'REVIEW_REQUIRED' : null
}

function summarizeStatuses(
  statuses: NonNullable<RawGiteaCombinedStatusResponse['statuses']>
): ProviderCheckSummary {
  const counts = { total: statuses.length, passed: 0, failed: 0, pending: 0, neutral: 0 }
  for (const status of statuses) {
    switch ((status.status ?? status.state ?? '').trim().toLowerCase()) {
      case 'success':
        counts.passed += 1
        break
      case 'failure':
      case 'error':
      case 'warning':
        counts.failed += 1
        break
      case 'pending':
        counts.pending += 1
        break
      default:
        counts.neutral += 1
    }
  }
  return { state: resolveProviderCheckState(counts), ...counts }
}

/** Best-effort: a failed side read only omits that column's data, never the PR row. */
export async function fetchGiteaPullSignals(
  repo: GiteaRepoRef,
  number: number,
  pull: RawGiteaPullDetail | null,
  noCache: boolean
): Promise<GiteaPullSignals> {
  const sha = pull?.head?.sha?.trim()
  const [reviews, status] = await Promise.allSettled([
    giteaGet<RawGiteaReview[]>(repo, repoApiPath(repo, `/pulls/${number}/reviews`), undefined, {
      noCache
    }),
    sha
      ? giteaGet<RawGiteaCombinedStatusResponse>(
          repo,
          repoApiPath(repo, `/commits/${encodeURIComponent(sha)}/status`),
          undefined,
          { noCache }
        )
      : Promise.reject(new Error('no head sha'))
  ])
  const reviewRequests = (pull?.requested_reviewers ?? [])
    .map(mapGiteaUser)
    .filter((user): user is NonNullable<typeof user> => user !== null)
  const latestReviews =
    reviews.status === 'fulfilled' ? latestDecisiveReviews(reviews.value.data ?? []) : null
  return {
    reviewRequests,
    ...(latestReviews
      ? {
          latestReviews,
          reviewDecision: reviewDecisionFor(latestReviews, reviewRequests.length > 0)
        }
      : {}),
    ...(status.status === 'fulfilled'
      ? { checksSummary: summarizeStatuses(status.value.data?.statuses ?? []) }
      : {})
  }
}
