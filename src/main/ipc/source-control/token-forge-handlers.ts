import { registerBitbucketHandlers } from './bitbucket'
import { registerGiteaInstanceHandlers } from './gitea-instances'
import { registerGiteaWorkItemHandlers } from './gitea-work-item-handlers'
import type { Store } from '../../persistence/loading-store/store'

/** Forges whose credentials Orca stores itself rather than reading from a CLI. */
export function registerTokenForgeHandlers(store: Store): void {
  registerBitbucketHandlers()
  registerGiteaInstanceHandlers()
  registerGiteaWorkItemHandlers(store)
}
