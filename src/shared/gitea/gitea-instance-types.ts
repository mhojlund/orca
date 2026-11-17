import type { SecretAtRestProtection } from '../secret-at-rest-protection'

export type GiteaServerKind = 'gitea' | 'forgejo'

export type GiteaInstance = {
  /** Normalized web base URL; stable key for the stored token. */
  id: string
  host: string
  webBaseUrl: string
  apiBaseUrl: string
  account: string | null
  serverKind: GiteaServerKind | null
  serverVersion: string | null
  updatedAt: string
}

// Never return tokens over IPC/RPC.
export type GiteaInstanceStatus = GiteaInstance & {
  credentialProtection: SecretAtRestProtection | null
}

export type GiteaConnectionStatus = {
  environment: { configured: boolean; baseUrl: string | null }
  instances: GiteaInstanceStatus[]
}

export type GiteaConnectArgs = { baseUrl: string; token: string }

export const GITEA_CONNECT_FAILURE_COPY = {
  invalidInput: 'Invalid Gitea/Forgejo credentials',
  tokenRequired: 'Enter a personal access token.',
  invalidUrl: 'Enter a valid http(s) instance URL.',
  rejected: 'The instance rejected this token. Check the token and its scopes, then try again.',
  notGitea: 'This URL does not look like a Gitea or Forgejo instance.',
  unreachable: 'Could not reach the instance. Check your connection and the URL, then try again.'
} as const

export type GiteaConnectFailureCode = keyof typeof GITEA_CONNECT_FAILURE_COPY

export type GiteaConnectResult =
  | { ok: true; instance: GiteaInstance }
  | { ok: false; error: string; errorCode?: string }

export function giteaConnectFailure(
  errorCode: GiteaConnectFailureCode
): Extract<GiteaConnectResult, { ok: false }> {
  return { ok: false, error: GITEA_CONNECT_FAILURE_COPY[errorCode], errorCode }
}
