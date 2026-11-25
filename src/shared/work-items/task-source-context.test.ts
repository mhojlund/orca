import { describe, expect, it } from 'vitest'
import { normalizeTaskSourceContext } from './task-source-context'

describe('normalizeTaskSourceContext', () => {
  it('keeps a Gitea source so work items route to the Gitea forge', () => {
    expect(
      normalizeTaskSourceContext({ provider: 'gitea', projectId: 'p1', repoId: 'r1' })
    ).toMatchObject({ provider: 'gitea', projectId: 'p1', repoId: 'r1' })
  })
})
