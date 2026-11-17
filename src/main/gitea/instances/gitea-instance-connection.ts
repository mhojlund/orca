import { normalizeGiteaApiBaseUrl, normalizeGiteaWebBaseUrl } from '../gitea-api-base-url'
import {
  deleteGiteaInstance,
  getGiteaInstanceTokenProtection,
  listStoredGiteaInstances,
  saveGiteaInstance
} from './gitea-instance-store'
import {
  giteaConnectFailure,
  type GiteaConnectArgs,
  type GiteaConnectionStatus,
  type GiteaConnectResult,
  type GiteaInstance,
  type GiteaServerKind
} from '../../../shared/gitea/gitea-instance-types'
import { getGiteaEnvConfig } from './gitea-env-config'
import { jsonRecord, jsonString } from '../gitea-json-fields'

const VERIFY_TIMEOUT_MS = 6000

async function fetchJson(
  url: string,
  token: string | null
): Promise<{ status: number; body: unknown } | null> {
  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        ...(token ? { Authorization: `token ${token}` } : {})
      },
      signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS)
    })
    const body = response.ok ? await response.json().catch(() => null) : null
    return { status: response.status, body }
  } catch {
    return null
  }
}

async function detectServerKind(
  webBaseUrl: string,
  token: string
): Promise<{ kind: GiteaServerKind; version: string | null } | null> {
  const forgejo = await fetchJson(`${webBaseUrl}/api/forgejo/v1/version`, token)
  if (forgejo?.status === 200) {
    return { kind: 'forgejo', version: jsonString(jsonRecord(forgejo.body), 'version') }
  }
  return null
}

export async function connectGiteaInstance(input: GiteaConnectArgs): Promise<GiteaConnectResult> {
  const token = input.token.trim()
  if (!token) {
    return giteaConnectFailure('tokenRequired')
  }
  const webBaseUrl = normalizeGiteaWebBaseUrl(input.baseUrl)
  if (!webBaseUrl) {
    return giteaConnectFailure('invalidUrl')
  }
  const apiBaseUrl = normalizeGiteaApiBaseUrl(webBaseUrl)
  const version = await fetchJson(`${apiBaseUrl}/version`, token)
  if (!version) {
    return giteaConnectFailure('unreachable')
  }
  if (version.status === 401 || version.status === 403) {
    return giteaConnectFailure('rejected')
  }
  const serverVersion = jsonString(jsonRecord(version.body), 'version')
  if (version.status !== 200 || !serverVersion) {
    return giteaConnectFailure('notGitea')
  }
  const user = await fetchJson(`${apiBaseUrl}/user`, token)
  if (!user) {
    return giteaConnectFailure('unreachable')
  }
  if (user.status !== 200) {
    return giteaConnectFailure(user.status === 401 || user.status === 403 ? 'rejected' : 'notGitea')
  }
  const profile = jsonRecord(user.body)
  const forgejo = await detectServerKind(webBaseUrl, token)
  const instance: GiteaInstance = {
    id: webBaseUrl,
    host: new URL(webBaseUrl).hostname.toLowerCase(),
    webBaseUrl,
    apiBaseUrl,
    account:
      jsonString(profile, 'login') ??
      jsonString(profile, 'username') ??
      jsonString(profile, 'full_name'),
    serverKind: forgejo?.kind ?? 'gitea',
    serverVersion: forgejo?.version ?? serverVersion,
    updatedAt: new Date().toISOString()
  }
  saveGiteaInstance(instance, token)
  return { ok: true, instance }
}

export function disconnectGiteaInstance(instanceId: string): void {
  deleteGiteaInstance(instanceId)
}

export function getGiteaConnectionStatus(): GiteaConnectionStatus {
  const env = getGiteaEnvConfig()
  return {
    environment: {
      configured: env.token !== null || env.apiBaseUrl !== null,
      baseUrl: env.apiBaseUrl
    },
    instances: listStoredGiteaInstances().map((instance) => ({
      ...instance,
      credentialProtection: getGiteaInstanceTokenProtection(instance.id)
    }))
  }
}
