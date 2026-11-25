import { ipcRenderer } from 'electron'
import type { PreloadApi } from '../api-types'
import type { GiteaConnectArgs, GiteaConnectResult } from '../../shared/gitea/gitea-instance-types'

type MutationPayload = { repoPath: string; repoId?: string; type: 'issue' | 'pr'; number: number }

// Channel arguments mirror the gh:* work-item channels so callers can swap providers.
export const giteaApi = {
  issue: (args) => ipcRenderer.invoke('gitea:issue', args),
  workItem: (args) => ipcRenderer.invoke('gitea:workItem', args),
  workItemByOwnerRepo: (args) => ipcRenderer.invoke('gitea:workItemByOwnerRepo', args),
  workItemDetails: (args) => ipcRenderer.invoke('gitea:workItemDetails', args),
  notifyWorkItemMutated: (args) => ipcRenderer.invoke('gitea:notifyWorkItemMutated', args),
  createIssue: (args) => ipcRenderer.invoke('gitea:createIssue', args),
  countWorkItems: (args) => ipcRenderer.invoke('gitea:countWorkItems', args),
  listWorkItems: (args) => ipcRenderer.invoke('gitea:listWorkItems', args),
  updateIssue: (args) => ipcRenderer.invoke('gitea:updateIssue', args),
  addIssueComment: (args) => ipcRenderer.invoke('gitea:addIssueComment', args),
  listLabels: (args) => ipcRenderer.invoke('gitea:listLabels', args),
  listAssignableUsers: (args) => ipcRenderer.invoke('gitea:listAssignableUsers', args),
  uploadImage: (args) => ipcRenderer.invoke('gitea:uploadImage', args),
  onWorkItemMutated: (callback: (payload: MutationPayload) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: MutationPayload): void =>
      callback(payload)
    ipcRenderer.on('gitea:workItemMutated', listener)
    return () => ipcRenderer.removeListener('gitea:workItemMutated', listener)
  },
  instances: {
    connect: (args: GiteaConnectArgs): Promise<GiteaConnectResult> =>
      ipcRenderer.invoke('gitea:instances:connect', args),
    disconnect: (instanceId: string): Promise<void> =>
      ipcRenderer.invoke('gitea:instances:disconnect', instanceId),
    status: () => ipcRenderer.invoke('gitea:instances:status')
  }
} satisfies PreloadApi['gitea']
