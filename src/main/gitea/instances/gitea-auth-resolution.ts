import { CredentialDecryptionError } from '../../credentials/integration-credential-file'
import type { GiteaInstance } from '../../../shared/gitea/gitea-instance-types'
import { getGiteaEnvConfig } from './gitea-env-config'
import { listStoredGiteaInstances, readGiteaInstanceToken } from './gitea-instance-store'

export type GiteaRequestAuth = { apiBaseUrl: string; token: string | null }

type RepoAuthTarget = { host: string; apiBaseUrl: string; webBaseUrl: string }

function pathDepth(url: string): number {
  return new URL(url).pathname.split('/').filter(Boolean).length
}

/** Longest web-path prefix wins when several instances share a host. */
export function findGiteaInstanceForRepo(
  repo: RepoAuthTarget,
  instances: readonly GiteaInstance[] = listStoredGiteaInstances()
): GiteaInstance | null {
  const repoPath = new URL(repo.webBaseUrl).pathname.replace(/\/+$/, '')
  const matches = instances.filter((instance) => {
    if (instance.host !== repo.host.toLowerCase()) {
      return false
    }
    const instancePath = new URL(instance.webBaseUrl).pathname.replace(/\/+$/, '')
    return repoPath === instancePath || repoPath.startsWith(`${instancePath}/`)
  })
  return matches.sort((a, b) => pathDepth(b.webBaseUrl) - pathDepth(a.webBaseUrl))[0] ?? null
}

/** A stored token is only ever paired with its own instance's API base URL. */
export function resolveGiteaRequestAuth(repo: RepoAuthTarget): GiteaRequestAuth {
  const instance = findGiteaInstanceForRepo(repo)
  if (instance) {
    try {
      const token = readGiteaInstanceToken(instance.id)
      if (token) {
        return { apiBaseUrl: instance.apiBaseUrl, token }
      }
    } catch (error) {
      if (!(error instanceof CredentialDecryptionError)) {
        throw error
      }
    }
  }
  const env = getGiteaEnvConfig()
  return { apiBaseUrl: env.apiBaseUrl ?? repo.apiBaseUrl, token: env.token }
}

export function hasGiteaAuthForRepo(repo: RepoAuthTarget): boolean {
  return resolveGiteaRequestAuth(repo).token !== null
}
