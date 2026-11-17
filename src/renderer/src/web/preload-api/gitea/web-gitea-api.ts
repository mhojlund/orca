import type { PreloadApi } from '../../../../../preload/api-types'
import { mapRepoPathArg } from '@/runtime/source-control/forge/runtime-repo-selector-params'
import { callRuntimeResult } from '../../runtime/client/web-runtime-calls'
import { noopUnsubscribe } from '../web-storage'

export type WebGiteaApi = NonNullable<PreloadApi['gitea']>

type Result<K extends Exclude<keyof WebGiteaApi, 'instances'>> = Awaited<ReturnType<WebGiteaApi[K]>>

/** The web client reaches Gitea only through its paired runtime's gitea.* RPC. */
export function createGiteaApi(): WebGiteaApi {
  const route = <R>(method: string, args?: unknown): Promise<R> =>
    callRuntimeResult<R>(method, mapRepoPathArg(args))
  return {
    issue: (args) => route<Result<'issue'>>('gitea.issue', args),
    workItem: (args) => route<Result<'workItem'>>('gitea.workItem', args),
    workItemByOwnerRepo: ({ repo: ownerRepo, ...args }) =>
      route<Result<'workItemByOwnerRepo'>>('gitea.workItemByOwnerRepo', { ...args, ownerRepo }),
    workItemDetails: ({ number, type, ...args }) =>
      route<Result<'workItemDetails'>>('gitea.workItemDetails', {
        repoPath: args.repoPath,
        repoId: args.repoId,
        number,
        ...(type ? { type } : {})
      }),
    // Mutations broadcast from the runtime; there is no local window to notify.
    notifyWorkItemMutated: () => Promise.resolve(true),
    onWorkItemMutated: () => noopUnsubscribe,
    createIssue: (args) => route<Result<'createIssue'>>('gitea.createIssue', args),
    countWorkItems: ({ wakeWslDistro: _wake, ...args }) =>
      route<Result<'countWorkItems'>>('gitea.countWorkItems', args),
    listWorkItems: ({ wakeWslDistro: _wake, ...args }) =>
      route<Result<'listWorkItems'>>('gitea.listWorkItems', args),
    updateIssue: (args) => route<Result<'updateIssue'>>('gitea.updateIssue', args),
    addIssueComment: (args) => route<Result<'addIssueComment'>>('gitea.addIssueComment', args),
    listLabels: (args) => route<Result<'listLabels'>>('gitea.listLabels', args),
    listAssignableUsers: (args) =>
      route<Result<'listAssignableUsers'>>('gitea.listAssignableUsers', args),
    uploadImage: () =>
      Promise.reject(
        new Error('Image uploads to Gitea/Forgejo are not available in the web client.')
      ),
    instances: {
      status: () => callRuntimeResult('gitea.instances.status'),
      connect: (args) => callRuntimeResult('gitea.instances.connect', args),
      disconnect: (instanceId) => callRuntimeResult('gitea.instances.disconnect', { instanceId })
    }
  }
}
