import {
  requestHostedReviewResponse,
  type HostedReviewApiResponse
} from '../../source-control/hosted-review-api-request'
import { resolveGiteaRequestAuth } from '../instances/gitea-auth-resolution'
import type { GiteaRepoRef } from '../repository-ref'

const REQUEST_TIMEOUT_MS = 15_000
const UPLOAD_TIMEOUT_MS = 60_000
// Mirrors `gh api --cache 60s` so list/count/detail fan-out does not re-hit the instance.
const CACHE_TTL_MS = 60_000
const CACHE_MAX_ENTRIES = 500

type SearchParams = Record<string, string | number | boolean | undefined | null>

const responseCache = new Map<
  string,
  { expiresAt: number; response: HostedReviewApiResponse<unknown> }
>()

export function encodedRepoPath(repo: Pick<GiteaRepoRef, 'owner' | 'repo'>): string {
  return `${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}`
}

export function repoApiPath(repo: Pick<GiteaRepoRef, 'owner' | 'repo'>, suffix = ''): string {
  return `/repos/${encodedRepoPath(repo)}${suffix}`
}

function buildUrl(apiBaseUrl: string, path: string, params?: SearchParams): URL {
  const url = new URL(`${apiBaseUrl.replace(/\/+$/, '')}${path}`)
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value))
    }
  }
  return url
}

function authHeaders(token: string | null): Record<string, string> {
  return token ? { Authorization: `token ${token}` } : {}
}

function remember(key: string, response: HostedReviewApiResponse<unknown>): void {
  responseCache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, response })
  while (responseCache.size > CACHE_MAX_ENTRIES) {
    const oldest = responseCache.keys().next().value
    if (oldest === undefined) {
      return
    }
    responseCache.delete(oldest)
  }
}

export async function giteaGet<T>(
  repo: GiteaRepoRef,
  path: string,
  params?: SearchParams,
  options: { noCache?: boolean; timeoutMs?: number } = {}
): Promise<HostedReviewApiResponse<T>> {
  const auth = await resolveGiteaRequestAuth(repo)
  const url = buildUrl(auth.apiBaseUrl, path, params)
  // Token presence is part of the key so a newly connected instance is not served anonymous results.
  const key = `${auth.token ? 'auth' : 'anon'}|${url.toString()}`
  const cached = options.noCache ? undefined : responseCache.get(key)
  if (cached && cached.expiresAt > Date.now()) {
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: entries are keyed by request URL, so a hit was stored by the same typed read.
    return cached.response as HostedReviewApiResponse<T>
  }
  const response = await requestHostedReviewResponse<T>(
    url,
    { headers: { Accept: 'application/json', ...authHeaders(auth.token) } },
    options.timeoutMs ?? REQUEST_TIMEOUT_MS
  )
  remember(key, response)
  return response
}

/** Drops cached reads for one repository after a write. */
export async function invalidateGiteaRepoCache(repo: GiteaRepoRef): Promise<void> {
  const auth = await resolveGiteaRequestAuth(repo)
  const prefix = buildUrl(auth.apiBaseUrl, repoApiPath(repo)).toString()
  for (const key of responseCache.keys()) {
    if (key.slice(key.indexOf('|') + 1).startsWith(prefix)) {
      responseCache.delete(key)
    }
  }
}

export async function giteaSend<T>(
  repo: GiteaRepoRef,
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown
): Promise<T | null> {
  const auth = await resolveGiteaRequestAuth(repo)
  try {
    const response = await requestHostedReviewResponse<T>(
      buildUrl(auth.apiBaseUrl, path),
      {
        method,
        headers: {
          Accept: 'application/json',
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...authHeaders(auth.token)
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {})
      },
      REQUEST_TIMEOUT_MS
    )
    return response.data
  } finally {
    await invalidateGiteaRepoCache(repo)
  }
}

export async function giteaUpload<T>(
  repo: GiteaRepoRef,
  path: string,
  form: FormData
): Promise<T | null> {
  const auth = await resolveGiteaRequestAuth(repo)
  const response = await requestHostedReviewResponse<T>(
    buildUrl(auth.apiBaseUrl, path),
    {
      method: 'POST',
      headers: { Accept: 'application/json', ...authHeaders(auth.token) },
      body: form
    },
    UPLOAD_TIMEOUT_MS
  )
  return response.data
}

/** @internal - tests need isolation from earlier cached responses. */
export function _resetGiteaResponseCache(): void {
  responseCache.clear()
}

export function totalCountHeader(headers: Headers): number | null {
  const value = Number.parseInt(headers.get('x-total-count') ?? '', 10)
  return Number.isFinite(value) && value >= 0 ? value : null
}
