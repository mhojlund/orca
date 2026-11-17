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

vi.mock('./gitea-work-item-source', () => ({
  toOwnerRepo: (ref: GiteaRepoRef | null) =>
    ref ? { owner: ref.owner, repo: ref.repo, host: ref.host } : null,
  resolveGiteaItemRepo: async () => repo,
  resolveGiteaWorkItemSources: async () => ({
    issues: repo,
    prs: repo,
    origin: repo,
    upstream: null,
    issueSourceFellBack: false,
    ineligible: false
  })
}))

import { _resetGiteaResponseCache } from './gitea-api'
import { countGiteaWorkItems, listGiteaWorkItems } from './list-gitea-work-items'
import { updateGiteaIssue } from './gitea-issue-mutations'

type Call = { method: string; url: URL; body: unknown }

function stubFetch(routes: (call: Call) => { status?: number; body: unknown; total?: number }) {
  const calls: Call[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: URL | string, init?: RequestInit) => {
      const call = {
        method: init?.method ?? 'GET',
        url: new URL(String(input)),
        body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined
      }
      calls.push(call)
      const { status = 200, body, total } = routes(call)
      return new Response(body === undefined ? null : JSON.stringify(body), {
        status,
        headers: total === undefined ? {} : { 'X-Total-Count': String(total) }
      })
    })
  )
  return calls
}

describe('Gitea work items', () => {
  beforeEach(() => _resetGiteaResponseCache())
  afterEach(() => vi.unstubAllGlobals())

  it('lists only issues and maps them to GitHub work items', async () => {
    const calls = stubFetch(({ url }) =>
      url.pathname === '/api/v1/user'
        ? { body: { login: 'alice' } }
        : {
            body: [
              {
                number: 12,
                title: 'Crash on start',
                state: 'open',
                html_url: 'https://codeberg.org/team/app/issues/12',
                updated_at: '2026-11-01T00:00:00Z',
                comments: 3,
                user: { login: 'bob', avatar_url: 'https://a/b.png' },
                labels: [{ id: 1, name: 'bug' }],
                assignees: [{ login: 'alice', full_name: 'Alice' }]
              }
            ],
            total: 42
          }
    )
    const result = await listGiteaWorkItems('/repo', 24, 'is:issue is:open assignee:@me')
    const list = calls.find((call) => call.url.pathname === '/api/v1/repos/team/app/issues')
    expect(list?.url.searchParams.get('type')).toBe('issues')
    expect(list?.url.searchParams.get('assigned_by')).toBe('alice')
    expect(result.items).toEqual([
      expect.objectContaining({
        id: 'issue:12',
        type: 'issue',
        number: 12,
        state: 'open',
        labels: ['bug'],
        author: 'bob',
        commentCount: 3,
        assignees: [{ login: 'alice', name: 'Alice', avatarUrl: '' }]
      })
    ])
    expect(await countGiteaWorkItems('/repo', 'is:issue is:open')).toBe(42)
  })

  it('replaces the full assignee list and adds labels by id', async () => {
    const calls = stubFetch(({ method, url }) => {
      if (method === 'GET' && url.pathname.endsWith('/issues/5')) {
        return { body: { number: 5, assignees: [{ login: 'alice' }, { login: 'bob' }] } }
      }
      if (url.pathname.endsWith('/labels') && method === 'GET') {
        return { body: url.pathname.startsWith('/api/v1/orgs') ? [] : [{ id: 3, name: 'bug' }] }
      }
      return { body: {} }
    })
    const result = await updateGiteaIssue({ repoPath: '/repo' }, 5, {
      addAssignees: ['carol'],
      removeAssignees: ['alice'],
      addLabels: ['Bug']
    })
    expect(result).toEqual({ ok: true })
    expect(calls.find((call) => call.method === 'PATCH')?.body).toEqual({
      assignees: ['bob', 'carol']
    })
    expect(calls.find((call) => call.method === 'POST')?.body).toEqual({ labels: [3] })
  })

  it('refuses close reasons Gitea cannot store', async () => {
    stubFetch(() => ({ body: {} }))
    const result = await updateGiteaIssue({ repoPath: '/repo' }, 5, {
      state: 'closed',
      stateReason: 'not_planned'
    })
    expect(result).toMatchObject({ ok: false, errorCode: 'gitea.closeReasonUnsupported' })
  })
})
