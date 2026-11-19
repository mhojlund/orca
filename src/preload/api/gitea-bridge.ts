import { ipcRenderer } from 'electron'
import type { PreloadApi } from '../api-types'
import type { GiteaConnectArgs, GiteaConnectResult } from '../../shared/gitea/gitea-instance-types'

export const giteaApi = {
  instances: {
    connect: (args: GiteaConnectArgs): Promise<GiteaConnectResult> =>
      ipcRenderer.invoke('gitea:instances:connect', args),
    disconnect: (instanceId: string): Promise<void> =>
      ipcRenderer.invoke('gitea:instances:disconnect', instanceId),
    status: () => ipcRenderer.invoke('gitea:instances:status')
  }
} satisfies PreloadApi['gitea']
