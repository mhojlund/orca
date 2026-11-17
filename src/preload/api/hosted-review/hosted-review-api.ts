import type {
  BitbucketConnectArgs,
  BitbucketConnectResult,
  BitbucketConnectionStatus
} from '../../../shared/bitbucket/bitbucket-credentials'
import type {
  GiteaConnectArgs,
  GiteaConnectResult,
  GiteaConnectionStatus
} from '../../shared/gitea/gitea-instance-types'
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

export type GiteaApi = {
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
