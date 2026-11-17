import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { writeEncryptedCredential } from '../../credentials/integration-credential-file'
import { readCredentialFileProtection } from '../../credentials/credential-file-protection'
import { createIntegrationStateFileCache } from '../../credentials/integration-state-file-cache'
import { createIntegrationTokenFileCache } from '../../credentials/integration-token-file-cache'
import type { SecretAtRestProtection } from '../../../shared/secret-at-rest-protection'
import type { GiteaInstance } from '../../../shared/gitea/gitea-instance-types'
import { jsonRecord } from '../gitea-json-fields'

type GiteaInstanceFile = { version: 1; instances: GiteaInstance[] }

const instanceFileCache = createIntegrationStateFileCache({
  filePath: getInstanceFilePath,
  readFromDisk: readInstanceFileFromDisk
})
const tokenFileCache = createIntegrationTokenFileCache({ service: 'Gitea', filePath: getTokenPath })

function getOrcaDir(): string {
  return join(homedir(), '.orca')
}

function getInstanceFilePath(): string {
  return join(getOrcaDir(), 'gitea-instances.json')
}

function getTokenDir(): string {
  return join(getOrcaDir(), 'gitea-tokens')
}

function getTokenPath(instanceId: string): string {
  return join(getTokenDir(), `${Buffer.from(instanceId).toString('base64url')}.enc`)
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function normalizeInstance(input: unknown): GiteaInstance | null {
  const r = jsonRecord(input)
  if (!r) {
    return null
  }
  const id = str(r.id)
  const host = str(r.host)
  const webBaseUrl = str(r.webBaseUrl)
  const apiBaseUrl = str(r.apiBaseUrl)
  if (!id || !host || !webBaseUrl || !apiBaseUrl) {
    return null
  }
  return {
    id,
    host,
    webBaseUrl,
    apiBaseUrl,
    account: str(r.account),
    serverKind: r.serverKind === 'gitea' || r.serverKind === 'forgejo' ? r.serverKind : null,
    serverVersion: str(r.serverVersion),
    updatedAt: str(r.updatedAt) ?? ''
  }
}

function readInstanceFileFromDisk(): GiteaInstanceFile {
  const path = getInstanceFilePath()
  if (!existsSync(path)) {
    return { version: 1, instances: [] }
  }
  try {
    const parsed = jsonRecord(JSON.parse(readFileSync(path, 'utf-8')))
    const instances = Array.isArray(parsed?.instances)
      ? parsed.instances
          .map(normalizeInstance)
          .filter((instance): instance is GiteaInstance => instance !== null)
      : []
    return { version: 1, instances }
  } catch {
    return { version: 1, instances: [] }
  }
}

// Presence checks never decrypt, so status reads cannot trigger keychain prompts.
export function listStoredGiteaInstances(): GiteaInstance[] {
  return instanceFileCache.get().instances.filter((instance) => tokenFileCache.has(instance.id))
}

export function readGiteaInstanceToken(instanceId: string): string | null {
  return tokenFileCache.read(instanceId)
}

export function getGiteaInstanceTokenProtection(instanceId: string): SecretAtRestProtection | null {
  return readCredentialFileProtection(getTokenPath(instanceId))
}

function writeInstanceFile(file: GiteaInstanceFile): void {
  mkdirSync(getOrcaDir(), { recursive: true })
  writeFileSync(getInstanceFilePath(), JSON.stringify(file, null, 2), {
    encoding: 'utf-8',
    mode: 0o600
  })
  instanceFileCache.invalidate()
}

export function saveGiteaInstance(instance: GiteaInstance, token: string): void {
  mkdirSync(getTokenDir(), { recursive: true })
  writeEncryptedCredential('Gitea', getTokenPath(instance.id), token)
  tokenFileCache.forget(instance.id)
  const others = instanceFileCache.get().instances.filter((entry) => entry.id !== instance.id)
  writeInstanceFile({ version: 1, instances: [...others, instance] })
}

export function deleteGiteaInstance(instanceId: string): void {
  tokenFileCache.forget(instanceId)
  try {
    unlinkSync(getTokenPath(instanceId))
  } catch {}
  const remaining = instanceFileCache.get().instances.filter((entry) => entry.id !== instanceId)
  writeInstanceFile({ version: 1, instances: remaining })
}
