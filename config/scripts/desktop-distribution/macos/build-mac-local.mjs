import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function createLocalBuildVersion(baseVersion, timestamp, commit) {
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(baseVersion)) {
    throw new Error(`Package version is not valid semver: ${baseVersion}`)
  }
  if (!Number.isSafeInteger(timestamp) || timestamp <= 0) {
    throw new Error('Local build timestamp is invalid.')
  }
  const sanitizedCommit = commit.replace(/[^0-9A-Za-z-]/g, '').slice(0, 12)
  if (!sanitizedCommit) {
    throw new Error('Git commit identity is empty.')
  }
  const suffix = `local.${timestamp}.${sanitizedCommit}`
  return baseVersion.includes('-') ? `${baseVersion}.${suffix}` : `${baseVersion}-${suffix}`
}

// Upstream main never carries the release version (tags do), so the fork mirrors the tags and the flavor build reads them here.
const RS_VERSION_TAG_REMOTE = 'https://github.com/mhojlund/orca.git'
const STABLE_TAG_REF = /^refs\/tags\/v(\d+)\.(\d+)\.(\d+)$/

function isNewerVersion(candidate, current) {
  const index = candidate.findIndex((part, i) => part !== current[i])
  return index !== -1 && candidate[index] > current[index]
}

export function pickLatestStableVersion(lsRemoteOutput) {
  let best = null
  for (const line of lsRemoteOutput.split('\n')) {
    const match = STABLE_TAG_REF.exec(line.split('\t')[1] ?? '')
    if (!match) {
      continue
    }
    const parts = match.slice(1).map(Number)
    if (!best || isNewerVersion(parts, best)) {
      best = parts
    }
  }
  return best ? best.join('.') : null
}

export function createRsBuildVersion(baseVersion) {
  if (!/^\d+\.\d+\.\d+$/.test(baseVersion)) {
    throw new Error(`Base version is not a stable X.Y.Z: ${baseVersion}`)
  }
  return `${baseVersion}-rs`
}

function resolveRsBaseVersion(env) {
  if (env.ORCA_BASE_VERSION) {
    return env.ORCA_BASE_VERSION
  }
  let output
  try {
    output = execFileSync('git', ['ls-remote', '--tags', '--refs', RS_VERSION_TAG_REMOTE, 'v*'], {
      encoding: 'utf8',
      timeout: 60_000
    })
  } catch (error) {
    throw new Error(
      `Could not read release tags from ${RS_VERSION_TAG_REMOTE} (${error.message}); set ORCA_BASE_VERSION=X.Y.Z to build offline.`
    )
  }
  const version = pickLatestStableVersion(output)
  if (!version) {
    throw new Error(
      `No stable vX.Y.Z tags on ${RS_VERSION_TAG_REMOTE}; run fork-sync.sh or set ORCA_BASE_VERSION=X.Y.Z.`
    )
  }
  return version
}

export function getLocalBuildIdentity(env = process.env) {
  const packageJson = JSON.parse(readFileSync(resolve('package.json'), 'utf8'))
  const commit = execFileSync('git', ['rev-parse', '--short=12', 'HEAD'], {
    encoding: 'utf8'
  }).trim()
  return {
    commit,
    version:
      env.ORCA_APP_FLAVOR === 'rs'
        ? createRsBuildVersion(resolveRsBaseVersion(env))
        : createLocalBuildVersion(packageJson.version, Date.now(), commit)
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const identity = getLocalBuildIdentity()
  console.log(`[build:mac] local update version ${identity.version}`)
  execFileSync(
    process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
    ['exec', 'electron-builder', '--config', 'config/electron-builder.config.cjs', '--mac'],
    {
      env: {
        ...process.env,
        ORCA_BUILD_COMMIT: identity.commit,
        ORCA_LOCAL_BUILD_VERSION: identity.version
      },
      stdio: 'inherit'
    }
  )
}
