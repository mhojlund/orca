import { ipcMain } from 'electron'
import {
  connectGiteaInstance,
  disconnectGiteaInstance,
  getGiteaConnectionStatus
} from '../../gitea/instances/gitea-instance-connection'
import { _resetPreflightCache } from '../../preflight/agent-detection'
import {
  giteaConnectFailure,
  type GiteaConnectArgs,
  type GiteaConnectResult,
  type GiteaConnectionStatus
} from '../../../shared/gitea/gitea-instance-types'

function normalizeConnectInput(value: unknown): GiteaConnectArgs | null {
  if (!value || typeof value !== 'object') {
    return null
  }
  const raw = value as Record<string, unknown>
  if (typeof raw.baseUrl !== 'string' || typeof raw.token !== 'string') {
    return null
  }
  return { baseUrl: raw.baseUrl, token: raw.token }
}

export function registerGiteaInstanceHandlers(): void {
  ipcMain.handle(
    'gitea:instances:connect',
    async (_event, args: unknown): Promise<GiteaConnectResult> => {
      const input = normalizeConnectInput(args)
      if (!input) {
        return giteaConnectFailure('invalidInput')
      }
      const result = await connectGiteaInstance(input)
      if (result.ok) {
        _resetPreflightCache()
      }
      return result
    }
  )

  ipcMain.handle('gitea:instances:disconnect', async (_event, instanceId: unknown) => {
    if (typeof instanceId !== 'string' || !instanceId) {
      return
    }
    disconnectGiteaInstance(instanceId)
    _resetPreflightCache()
  })

  ipcMain.handle('gitea:instances:status', async (): Promise<GiteaConnectionStatus> =>
    getGiteaConnectionStatus()
  )
}
