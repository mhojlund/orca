import { describe, expect, it } from 'vitest'
import { giteaIssueListParams, planGiteaQuery } from './gitea-task-query'

describe('planGiteaQuery', () => {
  it('maps GitHub-style qualifiers onto Gitea issue list params', () => {
    const plan = planGiteaQuery(
      'is:issue is:open assignee:@me author:bob label:bug label:"needs triage" crash'
    )
    expect(giteaIssueListParams(plan, 'issues', 'alice')).toEqual({
      type: 'issues',
      state: 'open',
      q: 'crash',
      labels: 'bug,needs triage',
      assigned_by: 'alice',
      created_by: 'bob'
    })
  })

  it('narrows merged PRs client-side from the closed list', () => {
    const plan = planGiteaQuery('is:pr is:merged')
    expect(plan.mergedOnly).toBe(true)
    expect(giteaIssueListParams(plan, 'pulls', null)).toEqual({ type: 'pulls', state: 'closed' })
  })

  it('reports qualifiers Gitea cannot express', () => {
    expect(planGiteaQuery('is:pr reviewed-by:carol').unsupported).toEqual(['reviewed-by:carol'])
  })
})
