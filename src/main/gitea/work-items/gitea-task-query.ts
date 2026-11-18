import { parseTaskQuery, stripRepoQualifiers } from '../../../shared/work-items/task-query'

export type GiteaListPlan = {
  scope: 'all' | 'issue' | 'pr'
  /** Server-side state; merged/draft narrow PR rows client-side. */
  state: 'open' | 'closed' | 'all'
  mergedOnly: boolean
  draftOnly: boolean
  assignee: string | null
  author: string | null
  /** Gitea can only search review requests for the signed-in user. */
  reviewRequestedByViewer: boolean
  labels: string[]
  freeText: string
  /** Qualifiers Gitea cannot express; the list ignores them and reports a hint. */
  unsupported: string[]
}

export function planGiteaQuery(rawQuery: string | undefined): GiteaListPlan {
  const parsed = parseTaskQuery(stripRepoQualifiers(rawQuery?.trim() ?? ''))
  const unsupported: string[] = []
  if (parsed.reviewedBy) {
    unsupported.push(`reviewed-by:${parsed.reviewedBy}`)
  }
  if (parsed.reviewRequested && parsed.reviewRequested !== '@me') {
    unsupported.push(`review-requested:${parsed.reviewRequested}`)
  }
  return {
    scope: parsed.scope,
    state:
      parsed.state === 'merged'
        ? 'closed'
        : parsed.state === 'open' || parsed.state === 'closed'
          ? parsed.state
          : 'all',
    mergedOnly: parsed.state === 'merged',
    draftOnly: parsed.draft,
    assignee: parsed.assignee,
    author: parsed.authors[0] ?? null,
    reviewRequestedByViewer: parsed.reviewRequested === '@me',
    labels: parsed.labels,
    freeText: parsed.freeText,
    unsupported
  }
}

/** Gitea's issue list params for one item type; `viewerLogin` resolves `@me`. */
export function giteaIssueListParams(
  plan: GiteaListPlan,
  type: 'issues' | 'pulls',
  viewerLogin: string | null
): Record<string, string> {
  const resolve = (value: string | null): string | undefined =>
    value === null ? undefined : value === '@me' ? (viewerLogin ?? undefined) : value
  const params: Record<string, string | undefined> = {
    type,
    state: plan.state,
    q: plan.freeText || undefined,
    labels: plan.labels.length > 0 ? plan.labels.join(',') : undefined,
    assigned_by: resolve(plan.assignee),
    created_by: resolve(plan.author)
  }
  return Object.fromEntries(
    Object.entries(params).filter((entry): entry is [string, string] => entry[1] !== undefined)
  )
}

/** `@me` qualifiers cannot be answered without a signed-in viewer. */
export function planNeedsViewer(plan: GiteaListPlan): boolean {
  return plan.assignee === '@me' || plan.author === '@me' || plan.reviewRequestedByViewer
}
