import type {
  GitHubCreateIssueFields,
  GitHubIssueUpdate
} from '../../../../shared/issue-mutation-types'
import type { GitHubOwnerRepo } from '../../../../shared/github/pull-request-types'
import { getRepoRoutingConnectionId } from '../../../../shared/execution-host'
import type { Repo } from '../../../../shared/repo-types'
import type { LocalProjectGhExecOptions } from '../../../workspaces/execution-host/project-runtime-git-options'
import {
  countGiteaWorkItems,
  listGiteaWorkItems
} from '../../../gitea/work-items/list-gitea-work-items'
import {
  getGiteaIssue,
  getGiteaWorkItem,
  getGiteaWorkItemByOwnerRepo,
  getGiteaWorkItemDetails
} from '../../../gitea/work-items/gitea-work-item-read'
import {
  addGiteaIssueComment,
  createGiteaIssue,
  updateGiteaIssue
} from '../../../gitea/work-items/gitea-issue-mutations'
import {
  listGiteaAssignableUsers,
  listGiteaLabels
} from '../../../gitea/work-items/gitea-issue-field-options'

type Deps = {
  resolveRepo: (selector: string) => Promise<Repo>
  getLocalGitArgs: (repo: Repo) => [] | [LocalProjectGhExecOptions]
}

/** Runtime RPC surface for Gitea/Forgejo work items; mirrors the GitHub repo work-item commands. */
export class RuntimeGiteaWorkItemCommands {
  constructor(private readonly deps: Deps) {}

  private async target(selector: string) {
    const repo = await this.deps.resolveRepo(selector)
    return {
      repo,
      connectionId: getRepoRoutingConnectionId(repo),
      localGitOptions: this.deps.getLocalGitArgs(repo)[0] ?? {}
    }
  }

  private async locator(selector: string) {
    const { repo, connectionId, localGitOptions } = await this.target(selector)
    return {
      repoPath: repo.path,
      preference: repo.issueSourcePreference,
      connectionId,
      localGitOptions
    }
  }

  async listGiteaRepoWorkItems(
    selector: string,
    limit?: number,
    query?: string,
    page?: number,
    noCache?: boolean
  ): ReturnType<typeof listGiteaWorkItems> {
    const { repo, connectionId, localGitOptions } = await this.target(selector)
    return listGiteaWorkItems(
      repo.path,
      limit,
      query,
      page,
      repo.issueSourcePreference,
      connectionId,
      noCache,
      localGitOptions
    )
  }

  async countGiteaRepoWorkItems(selector: string, query?: string): Promise<number> {
    const { repo, connectionId, localGitOptions } = await this.target(selector)
    return countGiteaWorkItems(
      repo.path,
      query,
      repo.issueSourcePreference,
      connectionId,
      localGitOptions
    )
  }

  async getGiteaRepoIssue(selector: string, number: number): ReturnType<typeof getGiteaIssue> {
    const { repo, connectionId, localGitOptions } = await this.target(selector)
    return getGiteaIssue(
      repo.path,
      number,
      connectionId,
      localGitOptions,
      repo.issueSourcePreference
    )
  }

  async getGiteaRepoWorkItem(
    selector: string,
    number: number,
    type?: 'issue' | 'pr'
  ): ReturnType<typeof getGiteaWorkItem> {
    const { repo, connectionId, localGitOptions } = await this.target(selector)
    return getGiteaWorkItem(
      repo.path,
      number,
      type,
      connectionId,
      localGitOptions,
      repo.issueSourcePreference
    )
  }

  async getGiteaRepoWorkItemByOwnerRepo(
    selector: string,
    ownerRepo: GitHubOwnerRepo,
    number: number,
    type: 'issue' | 'pr'
  ): ReturnType<typeof getGiteaWorkItemByOwnerRepo> {
    await this.deps.resolveRepo(selector)
    return getGiteaWorkItemByOwnerRepo(ownerRepo, number, type)
  }

  async getGiteaRepoWorkItemDetails(
    selector: string,
    number: number,
    type?: 'issue' | 'pr'
  ): ReturnType<typeof getGiteaWorkItemDetails> {
    const { repo, connectionId, localGitOptions } = await this.target(selector)
    return getGiteaWorkItemDetails(
      repo.path,
      number,
      type,
      connectionId,
      localGitOptions,
      repo.issueSourcePreference
    )
  }

  async createGiteaRepoIssue(
    selector: string,
    title: string,
    body: string,
    fields?: GitHubCreateIssueFields
  ): ReturnType<typeof createGiteaIssue> {
    return createGiteaIssue(await this.locator(selector), title, body, fields)
  }

  async updateGiteaRepoIssue(
    selector: string,
    number: number,
    updates: GitHubIssueUpdate
  ): ReturnType<typeof updateGiteaIssue> {
    return updateGiteaIssue(await this.locator(selector), number, updates)
  }

  async addGiteaRepoIssueComment(
    selector: string,
    number: number,
    body: string,
    type?: 'issue' | 'pr'
  ): ReturnType<typeof addGiteaIssueComment> {
    return addGiteaIssueComment(await this.locator(selector), number, body, type)
  }

  async listGiteaRepoLabels(selector: string): Promise<string[]> {
    const target = await this.locator(selector)
    return listGiteaLabels(
      target.repoPath,
      target.preference,
      target.connectionId,
      target.localGitOptions
    )
  }

  async listGiteaRepoAssignableUsers(
    selector: string
  ): ReturnType<typeof listGiteaAssignableUsers> {
    const target = await this.locator(selector)
    return listGiteaAssignableUsers(
      target.repoPath,
      target.preference,
      target.connectionId,
      target.localGitOptions
    )
  }
}
