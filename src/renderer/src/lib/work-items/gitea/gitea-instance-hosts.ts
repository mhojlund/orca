import { useSyncExternalStore } from 'react'
import type { GiteaConnectionStatus } from '../../../../../shared/gitea/gitea-instance-types'

const EMPTY_HOSTS: ReadonlySet<string> = new Set()
let hosts: ReadonlySet<string> = EMPTY_HOSTS
let requested = false
const listeners = new Set<() => void>()

function hostOf(url: string | null | undefined): string | null {
  try {
    return url ? new URL(url).host.toLowerCase() : null
  } catch {
    return null
  }
}

function hostsFromStatus(status: GiteaConnectionStatus): ReadonlySet<string> {
  const next = new Set<string>()
  for (const instance of status.instances) {
    const host = hostOf(instance.webBaseUrl)
    if (host) {
      next.add(host)
    }
  }
  const envHost = hostOf(status.environment.baseUrl)
  if (envHost) {
    next.add(envHost)
  }
  return next
}

export async function refreshGiteaInstanceHosts(): Promise<void> {
  requested = true
  try {
    const next = hostsFromStatus(await window.api.gitea.instances.status())
    if (next.size !== hosts.size || [...next].some((host) => !hosts.has(host))) {
      hosts = next
      listeners.forEach((listener) => listener())
    }
  } catch {
    // Why: link recognition degrades to /pulls/ URLs only when the status read fails.
  }
}

/** Connected Gitea/Forgejo hosts (with port), used to tell their /issues/ URLs apart from GitHub's. */
export function getGiteaInstanceHosts(): ReadonlySet<string> {
  if (!requested) {
    void refreshGiteaInstanceHosts()
  }
  return hosts
}

export function useGiteaInstanceHosts(): ReadonlySet<string> {
  return useSyncExternalStore((listener) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }, getGiteaInstanceHosts)
}
