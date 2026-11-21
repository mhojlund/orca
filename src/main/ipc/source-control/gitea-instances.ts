import { ipcMain } from 'electron'
import {
  connectGiteaInstance,
  disconnectGiteaInstance,
  getGiteaConnectionStatus
} from '../../gitea/instances/gitea-instance-connection'
import { _resetPreflightCache } from '../../preflight/agent-detection'
import { jsonRecord } from '../../gitea/gitea-json-fields'
import {
  giteaConnectFailure,
  type GiteaConnectArgs,
  type GiteaConnectResult,
  type GiteaConnectionStatus
} from '../../../shared/gitea/gitea-instance-types'

function normalizeConnectInput(value: unknown): GiteaConnectArgs | null {
  const raw = jsonRecord(value)
  if (!raw || typeof raw.baseUrl !== 'string' || typeof raw.token !== 'string') {
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
    await disconnectGiteaInstance(instanceId)
    _resetPreflightCache()
  })

  ipcMain.handle('gitea:instances:status', async (): Promise<GiteaConnectionStatus> =>
    getGiteaConnectionStatus()
  )
}
