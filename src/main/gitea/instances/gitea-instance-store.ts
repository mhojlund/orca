import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { credentialFileExists, inCredentialFileOrder } from '../../credentials/credential-file-io'
import { writeEncryptedCredential } from '../../credentials/integration-credential-file'
import { readCredentialFileProtection } from '../../credentials/credential-file-protection'
import { createIntegrationStateFileCache } from '../../credentials/integration-state-file-cache'
import { createIntegrationTokenFileCache } from '../../credentials/integration-token-file-cache'
import type { SecretAtRestProtection } from '../../../shared/secure-storage/secret-at-rest-protection'
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

async function readInstanceFileFromDisk(): Promise<GiteaInstanceFile> {
  const path = getInstanceFilePath()
  if (!(await credentialFileExists(path))) {
    return { version: 1, instances: [] }
  }
  try {
    const parsed = jsonRecord(JSON.parse(await readFile(path, { encoding: 'utf-8' })))
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

async function readInstanceFile(): Promise<GiteaInstanceFile> {
  return inCredentialFileOrder(getInstanceFilePath(), () => instanceFileCache.get())
}

// Presence checks never decrypt, so status reads cannot trigger keychain prompts.
export async function listStoredGiteaInstances(): Promise<GiteaInstance[]> {
  const { instances } = await readInstanceFile()
  const presence = await Promise.all(instances.map((instance) => tokenFileCache.has(instance.id)))
  return instances.filter((_, index) => presence[index])
}

export async function readGiteaInstanceToken(instanceId: string): Promise<string | null> {
  return tokenFileCache.read(instanceId)
}

export async function getGiteaInstanceTokenProtection(
  instanceId: string
): Promise<SecretAtRestProtection | null> {
  return readCredentialFileProtection(getTokenPath(instanceId))
}

async function writeInstanceFile(file: GiteaInstanceFile): Promise<void> {
  return inCredentialFileOrder(getInstanceFilePath(), async () => {
    await mkdir(getOrcaDir(), { recursive: true })
    await writeFile(getInstanceFilePath(), JSON.stringify(file, null, 2), {
      encoding: 'utf-8',
      mode: 0o600
    })
    instanceFileCache.invalidate()
  })
}

export async function saveGiteaInstance(instance: GiteaInstance, token: string): Promise<void> {
  return inCredentialFileOrder(`${getInstanceFilePath()}.registry`, async () => {
    await inCredentialFileOrder(`${getTokenPath(instance.id)}.mutation`, async () => {
      await mkdir(getTokenDir(), { recursive: true })
      await writeEncryptedCredential('Gitea', getTokenPath(instance.id), token)
      tokenFileCache.forget(instance.id)
    })
    const others = (await readInstanceFile()).instances.filter((entry) => entry.id !== instance.id)
    await writeInstanceFile({ version: 1, instances: [...others, instance] })
  })
}

export async function deleteGiteaInstance(instanceId: string): Promise<void> {
  return inCredentialFileOrder(`${getInstanceFilePath()}.registry`, async () => {
    await inCredentialFileOrder(`${getTokenPath(instanceId)}.mutation`, async () => {
      tokenFileCache.forget(instanceId)
      try {
        await unlink(getTokenPath(instanceId))
      } catch {}
    })
    const remaining = (await readInstanceFile()).instances.filter(
      (entry) => entry.id !== instanceId
    )
    await writeInstanceFile({ version: 1, instances: remaining })
  })
}
