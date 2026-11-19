import { registerBitbucketHandlers } from './bitbucket'
import { registerGiteaInstanceHandlers } from './gitea-instances'

/** Forges whose credentials Orca stores itself rather than reading from a CLI. */
export function registerTokenForgeHandlers(): void {
  registerBitbucketHandlers()
  registerGiteaInstanceHandlers()
}
