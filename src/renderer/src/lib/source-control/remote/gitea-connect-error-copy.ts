import { translate } from '@/i18n/i18n'
import {
  GITEA_CONNECT_FAILURE_COPY as EN,
  type GiteaConnectFailureCode
} from '../../../../../shared/gitea/gitea-instance-types'

const COPY: Record<GiteaConnectFailureCode, () => string> = {
  invalidInput: () => translate('codeHost.giteaConnect.invalidInput', EN.invalidInput),
  tokenRequired: () => translate('codeHost.giteaConnect.tokenRequired', EN.tokenRequired),
  invalidUrl: () => translate('codeHost.giteaConnect.invalidUrl', EN.invalidUrl),
  rejected: () => translate('codeHost.giteaConnect.rejected', EN.rejected),
  notGitea: () => translate('codeHost.giteaConnect.notGitea', EN.notGitea),
  unreachable: () => translate('codeHost.giteaConnect.unreachable', EN.unreachable)
}

function isGiteaConnectFailureCode(code: unknown): code is GiteaConnectFailureCode {
  return typeof code === 'string' && Object.hasOwn(COPY, code)
}

/** A connect failure in the UI language; uncoded (older host) or unknown codes show the English `error`. */
export function giteaConnectErrorText(failure: { error: string; errorCode?: unknown }): string {
  return isGiteaConnectFailureCode(failure.errorCode) ? COPY[failure.errorCode]() : failure.error
}
