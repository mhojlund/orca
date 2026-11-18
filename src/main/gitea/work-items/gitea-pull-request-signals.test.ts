import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GiteaRepoRef } from '../repository-ref'

const repo: GiteaRepoRef = {
  host: 'codeberg.org',
  owner: 'team',
  repo: 'app',
  webBaseUrl: 'https://codeberg.org',
  apiBaseUrl: 'https://codeberg.org/api/v1'
}

vi.mock('../instances/gitea-auth-resolution', () => ({
  resolveGiteaRequestAuth: () => ({ apiBaseUrl: 'https://codeberg.org/api/v1', token: 'secret' }),
  findGiteaInstanceForRepo: () => null
}))

import { _resetGiteaResponseCache } from './gitea-api'
import { fetchGiteaPullSignals } from './gitea-pull-request-signals'

const pull = { head: { sha: 'abc' }, requested_reviewers: [{ login: 'dana' }] }

function stubRoutes(reviews: unknown, statuses: unknown): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: URL | string) => {
      const path = new URL(String(input)).pathname
      const body = path.endsWith('/reviews') ? reviews : statuses
      return body === null
        ? new Response('nope', { status: 500 })
        : new Response(JSON.stringify(body), { status: 200 })
    })
  )
}

describe('fetchGiteaPullSignals', () => {
  beforeEach(() => _resetGiteaResponseCache())
  afterEach(() => vi.unstubAllGlobals())

  it('lets a requested change beat an approval, ignoring dismissed reviews', async () => {
    stubRoutes(
      [
        { state: 'APPROVED', user: { login: 'amy' } },
        { state: 'REQUEST_CHANGES', user: { login: 'bo' } },
        { state: 'REQUEST_CHANGES', dismissed: true, user: { login: 'cy' } }
      ],
      { statuses: [] }
    )
    const signals = await fetchGiteaPullSignals(repo, 1, pull, true)
    expect(signals.reviewDecision).toBe('CHANGES_REQUESTED')
    expect(signals.latestReviews?.map((review) => review.login)).toEqual(['amy', 'bo'])
  })

  it('requires review while reviewers are requested and nobody has decided', async () => {
    stubRoutes([{ state: 'COMMENT', user: { login: 'amy' } }], { statuses: [] })
    expect((await fetchGiteaPullSignals(repo, 1, pull, true)).reviewDecision).toBe(
      'REVIEW_REQUIRED'
    )
  })

  it('counts commit statuses into a failing rollup', async () => {
    stubRoutes([], {
      statuses: [{ status: 'success' }, { status: 'failure' }, { status: 'pending' }]
    })
    expect((await fetchGiteaPullSignals(repo, 1, pull, true)).checksSummary).toEqual({
      state: 'failure',
      total: 3,
      passed: 1,
      failed: 1,
      pending: 1,
      neutral: 0
    })
  })

  it('omits a column whose request failed instead of failing the row', async () => {
    stubRoutes(null, null)
    const signals = await fetchGiteaPullSignals(repo, 1, pull, true)
    expect(signals.checksSummary).toBeUndefined()
    expect(signals.reviewDecision).toBeUndefined()
    expect(signals.reviewRequests?.map((user) => user.login)).toEqual(['dana'])
  })
})
