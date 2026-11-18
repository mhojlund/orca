import { defineMethod } from '../../../core'
import { _resetPreflightCache } from '../../../../../preflight/agent-detection'
import {
  connectGiteaInstance,
  disconnectGiteaInstance,
  getGiteaConnectionStatus
} from '../../../../../gitea/instances/gitea-instance-connection'
import { RepoSelector } from '../../../../../../shared/rpc-contract/github/github-repo-target-params'
import {
  WorkItem,
  WorkItemByOwnerRepo,
  WorkItemsCount,
  WorkItemsList
} from '../../../../../../shared/rpc-contract/github/github-repo-work-item-params'
import {
  CreateIssue,
  Issue,
  IssueComment,
  UpdateIssue
} from '../../../../../../shared/rpc-contract/github/github-issue-params'
import {
  GiteaInstanceConnect,
  GiteaInstanceDisconnect
} from '../../../../../../shared/rpc-contract/gitea-params'

// Names and params mirror the github.* work-item methods so clients can swap the prefix.
export const GITEA_METHODS = [
  defineMethod({
    name: 'gitea.listWorkItems',
    permission: 'workspace',
    params: WorkItemsList,
    handler: async (params, { runtime }) =>
      runtime.listGiteaRepoWorkItems(
        params.repo,
        params.limit,
        params.query,
        params.page,
        params.noCache
      )
  }),
  defineMethod({
    name: 'gitea.countWorkItems',
    permission: 'workspace',
    params: WorkItemsCount,
    handler: async (params, { runtime }) =>
      runtime.countGiteaRepoWorkItems(params.repo, params.query)
  }),
  defineMethod({
    name: 'gitea.issue',
    permission: 'workspace',
    params: Issue,
    handler: async (params, { runtime }) => runtime.getGiteaRepoIssue(params.repo, params.number)
  }),
  defineMethod({
    name: 'gitea.workItem',
    permission: 'workspace',
    params: WorkItem,
    handler: async (params, { runtime }) =>
      runtime.getGiteaRepoWorkItem(params.repo, params.number, params.type)
  }),
  defineMethod({
    name: 'gitea.workItemByOwnerRepo',
    permission: 'workspace',
    params: WorkItemByOwnerRepo,
    handler: async (params, { runtime }) =>
      runtime.getGiteaRepoWorkItemByOwnerRepo(
        params.repo,
        {
          owner: params.owner,
          repo: params.ownerRepo,
          ...(params.host ? { host: params.host } : {})
        },
        params.number,
        params.type
      )
  }),
  defineMethod({
    name: 'gitea.workItemDetails',
    permission: 'workspace',
    params: WorkItem,
    handler: async (params, { runtime }) =>
      runtime.getGiteaRepoWorkItemDetails(params.repo, params.number, params.type)
  }),
  defineMethod({
    name: 'gitea.createIssue',
    permission: 'workspace',
    params: CreateIssue,
    handler: async (params, { runtime }) =>
      runtime.createGiteaRepoIssue(params.repo, params.title, params.body, {
        labels: params.labels,
        assignees: params.assignees
      })
  }),
  defineMethod({
    name: 'gitea.updateIssue',
    permission: 'workspace',
    params: UpdateIssue,
    handler: async (params, { runtime }) =>
      runtime.updateGiteaRepoIssue(params.repo, params.number, params.updates)
  }),
  defineMethod({
    name: 'gitea.addIssueComment',
    permission: 'workspace',
    params: IssueComment,
    handler: async (params, { runtime }) =>
      runtime.addGiteaRepoIssueComment(params.repo, params.number, params.body, params.type)
  }),
  defineMethod({
    name: 'gitea.listLabels',
    permission: 'workspace',
    params: RepoSelector,
    handler: async (params, { runtime }) => runtime.listGiteaRepoLabels(params.repo)
  }),
  defineMethod({
    name: 'gitea.listAssignableUsers',
    permission: 'workspace',
    params: RepoSelector,
    handler: async (params, { runtime }) => runtime.listGiteaRepoAssignableUsers(params.repo)
  }),
  defineMethod({
    name: 'gitea.instances.status',
    permission: 'workspace',
    params: null,
    handler: async () => getGiteaConnectionStatus()
  }),
  defineMethod({
    name: 'gitea.instances.connect',
    permission: 'accounts-admin',
    params: GiteaInstanceConnect,
    handler: async (params) => {
      const result = await connectGiteaInstance(params)
      if (result.ok) {
        _resetPreflightCache()
      }
      return result
    }
  }),
  defineMethod({
    name: 'gitea.instances.disconnect',
    permission: 'accounts-admin',
    params: GiteaInstanceDisconnect,
    handler: async (params) => {
      disconnectGiteaInstance(params.instanceId)
      _resetPreflightCache()
    }
  })
]
