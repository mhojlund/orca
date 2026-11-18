import type {
  BitbucketConnectArgs,
  BitbucketConnectResult,
  BitbucketConnectionStatus
} from '../../../shared/bitbucket/bitbucket-credentials'
import type { GitHubRepoSelectorArgs, GithubWorkItemApi } from '../github/github-work-item-api'
import type {
  GiteaConnectArgs,
  GiteaConnectResult,
  GiteaConnectionStatus
} from '../../../shared/gitea/gitea-instance-types'
import type {
  CreateHostedReviewArgs,
  CreateHostedReviewResult,
  CreateStackedHostedReviewArgs,
  CreateStackedHostedReviewResult,
  HostedReviewCreationEligibility,
  HostedReviewCreationEligibilityArgs,
  HostedReviewForBranchArgs,
  HostedReviewForBranchReply,
  HostedReviewInfo
} from '../../../shared/source-control/hosted-review/hosted-review-contracts'

export type HostedReviewApi = {
  forBranch: {
    (
      args: HostedReviewForBranchArgs & { reportReadOutcome?: false }
    ): Promise<HostedReviewInfo | null>
    (args: HostedReviewForBranchArgs): Promise<HostedReviewForBranchReply>
  }
  getCreationEligibility: (
    args: HostedReviewCreationEligibilityArgs
  ) => Promise<HostedReviewCreationEligibility>
  create: (args: CreateHostedReviewArgs) => Promise<CreateHostedReviewResult>
  createStacked: (args: CreateStackedHostedReviewArgs) => Promise<CreateStackedHostedReviewResult>
}

export type GiteaWorkItemApi = Pick<
  GithubWorkItemApi,
  | 'issue'
  | 'workItem'
  | 'workItemByOwnerRepo'
  | 'workItemDetails'
  | 'notifyWorkItemMutated'
  | 'createIssue'
  | 'countWorkItems'
  | 'listWorkItems'
  | 'updateIssue'
  | 'addIssueComment'
  | 'listLabels'
  | 'listAssignableUsers'
  | 'onWorkItemMutated'
> & {
  /** Gitea stores images as assets of an existing issue. */
  uploadImage: (
    args: GitHubRepoSelectorArgs & {
      number: number
      fileName: string
      contentType: string
      bytes: Uint8Array
    }
  ) => Promise<{ url: string }>
}

export type GiteaApi = GiteaWorkItemApi & {
  instances: {
    connect: (args: GiteaConnectArgs) => Promise<GiteaConnectResult>
    disconnect: (instanceId: string) => Promise<void>
    status: () => Promise<GiteaConnectionStatus>
  }
}

export type BitbucketApi = {
  connect: (args: BitbucketConnectArgs) => Promise<BitbucketConnectResult>
  disconnect: () => Promise<void>
  status: () => Promise<BitbucketConnectionStatus>
}
