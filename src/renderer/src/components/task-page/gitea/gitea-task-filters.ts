export type GiteaKindFilter = 'issues' | 'prs'
export type GiteaStateFilter = 'open' | 'closed' | 'all'
export type GiteaInvolvementFilter = 'everyone' | 'assigned' | 'created'

export const GITEA_KIND_FILTERS: readonly GiteaKindFilter[] = ['issues', 'prs']
export const GITEA_STATE_FILTERS: readonly GiteaStateFilter[] = ['open', 'closed', 'all']
export const GITEA_INVOLVEMENT_FILTERS: readonly GiteaInvolvementFilter[] = [
  'everyone',
  'assigned',
  'created'
]

/** GitHub-style task query understood by the Gitea list planner. */
export function giteaIssueQuery(
  kind: GiteaKindFilter,
  state: GiteaStateFilter,
  involvement: GiteaInvolvementFilter
): string {
  return [
    kind === 'prs' ? 'is:pr' : 'is:issue',
    state === 'all' ? '' : `is:${state}`,
    involvement === 'assigned' ? 'assignee:@me' : '',
    involvement === 'created' ? 'author:@me' : ''
  ]
    .filter(Boolean)
    .join(' ')
}
