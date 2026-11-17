import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GiteaInstance } from '../../../shared/gitea/gitea-instance-types'

const instances: GiteaInstance[] = []
const tokens = new Map<string, string>()

vi.mock('./gitea-instance-store', () => ({
  listStoredGiteaInstances: () => instances,
  readGiteaInstanceToken: (id: string) => tokens.get(id) ?? null
}))

import { resolveGiteaRequestAuth } from './gitea-auth-resolution'

function instance(webBaseUrl: string): GiteaInstance {
  const url = new URL(webBaseUrl)
  return {
    id: webBaseUrl,
    host: url.hostname,
    webBaseUrl,
    apiBaseUrl: `${webBaseUrl}/api/v1`,
    account: null,
    serverKind: 'forgejo',
    serverVersion: null,
    updatedAt: ''
  }
}

function repo(webBaseUrl: string) {
  return {
    host: new URL(webBaseUrl).hostname,
    webBaseUrl,
    apiBaseUrl: `${webBaseUrl}/api/v1`
  }
}

describe('resolveGiteaRequestAuth', () => {
  beforeEach(() => {
    instances.length = 0
    tokens.clear()
    delete process.env.ORCA_GITEA_TOKEN
    delete process.env.ORCA_GITEA_API_BASE_URL
  })
  afterEach(() => {
    delete process.env.ORCA_GITEA_TOKEN
  })

  it('never sends a stored token to a different host', () => {
    instances.push(instance('https://codeberg.org'))
    tokens.set('https://codeberg.org', 'codeberg-secret')
    expect(resolveGiteaRequestAuth(repo('https://git.example.com'))).toEqual({
      apiBaseUrl: 'https://git.example.com/api/v1',
      token: null
    })
  })

  it('prefers the instance with the longest matching path prefix', () => {
    instances.push(instance('https://git.example.com'), instance('https://git.example.com/forge'))
    tokens.set('https://git.example.com', 'root')
    tokens.set('https://git.example.com/forge', 'sub')
    expect(resolveGiteaRequestAuth(repo('https://git.example.com/forge')).token).toBe('sub')
  })

  it('prefers a stored token over the environment token', () => {
    instances.push(instance('https://codeberg.org'))
    tokens.set('https://codeberg.org', 'stored')
    process.env.ORCA_GITEA_TOKEN = 'env'
    expect(resolveGiteaRequestAuth(repo('https://codeberg.org')).token).toBe('stored')
    expect(resolveGiteaRequestAuth(repo('https://other.example')).token).toBe('env')
  })
})
