import { getPublicForgeProviderForHost } from '../../../shared/git/remotes/public-forge-host'
import { NEGATIVE_ENTRY_TTL_MS } from '../../git/remotes/remote-ref-probe-cache'
import { getGiteaEnvConfig } from '../instances/gitea-env-config'
import { findGiteaInstanceForRepo } from '../instances/gitea-auth-resolution'
import { listStoredGiteaInstances } from '../instances/gitea-instance-store'
import type { GiteaRepoRef } from '../repository-ref'
import { jsonRecord, jsonString } from '../gitea-json-fields'

const PROBE_TIMEOUT_MS = 4000
const probeCache = new Map<string, { value: boolean; expiresAt: number }>()

function envHost(): string | null {
  const { apiBaseUrl } = getGiteaEnvConfig()
  try {
    return apiBaseUrl ? new URL(apiBaseUrl).hostname.toLowerCase() : null
  } catch {
    return null
  }
}

async function probeVersion(apiBaseUrl: string): Promise<boolean> {
  try {
    const response = await fetch(`${apiBaseUrl.replace(/\/+$/, '')}/version`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS)
    })
    if (!response.ok) {
      await response.body?.cancel()
      return false
    }
    return jsonString(jsonRecord(await response.json().catch(() => null)), 'version') !== null
  } catch {
    return false
  }
}

/**
 * parseGiteaRepoRef accepts any non-public host, so a self-hosted GitLab would parse as Gitea.
 * Only known hosts, or hosts answering Gitea's /version, count as Gitea.
 */
export async function isGiteaHost(repo: GiteaRepoRef): Promise<boolean> {
  if (
    findGiteaInstanceForRepo(repo, await listStoredGiteaInstances()) ||
    getPublicForgeProviderForHost(repo.host) === 'gitea' ||
    envHost() === repo.host
  ) {
    return true
  }
  const key = repo.apiBaseUrl
  const cached = probeCache.get(key)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value
  }
  const value = await probeVersion(repo.apiBaseUrl)
  probeCache.set(key, {
    value,
    expiresAt: value ? Number.POSITIVE_INFINITY : Date.now() + NEGATIVE_ENTRY_TTL_MS
  })
  return value
}

/** @internal - tests need a clean probe cache. */
export function _resetGiteaHostProbeCache(): void {
  probeCache.clear()
}
