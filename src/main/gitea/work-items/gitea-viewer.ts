import { resolveGiteaRequestAuth } from '../instances/gitea-auth-resolution'
import type { GiteaRepoRef } from '../repository-ref'
import { giteaGet } from './gitea-api'
import { giteaLogin, type RawGiteaUser } from './gitea-work-item-mappers'

export async function isGiteaRepoAuthenticated(repo: GiteaRepoRef): Promise<boolean> {
  return (await resolveGiteaRequestAuth(repo)).token !== null
}

/** Login of the token owner for this repo's instance; null when anonymous or unreachable. */
export async function getGiteaViewerLogin(repo: GiteaRepoRef): Promise<string | null> {
  if (!(await isGiteaRepoAuthenticated(repo))) {
    return null
  }
  try {
    const { data } = await giteaGet<RawGiteaUser>(repo, '/user')
    return giteaLogin(data)
  } catch {
    return null
  }
}
