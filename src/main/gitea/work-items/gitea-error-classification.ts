import type { ClassifiedError } from '../../../shared/errors/classified-error'
import { classifiedCodeHostError } from '../../../shared/source-control/code-host-failure-copy'
import { HostedReviewApiRequestError } from '../../source-control/hosted-review-api-request'
import { jsonRecord, jsonString } from '../gitea-json-fields'

function detailOf(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  // Gitea error bodies are JSON {message, url}; show only the message.
  try {
    const parsed = jsonString(jsonRecord(JSON.parse(message)), 'message')?.trim()
    if (parsed) {
      return parsed
    }
  } catch {}
  return message.trim().slice(0, 300)
}

export function classifyGiteaError(error: unknown, authenticated: boolean): ClassifiedError {
  if (error instanceof HostedReviewApiRequestError) {
    if (error.timedOut) {
      return classifiedCodeHostError('network_error', 'networkError')
    }
    switch (error.status ?? 0) {
      case 401:
        return classifiedCodeHostError('permission_denied', 'gitea.authRequired')
      case 403:
        return authenticated
          ? classifiedCodeHostError('permission_denied', 'gitea.permissionDenied')
          : classifiedCodeHostError('permission_denied', 'gitea.authRequired')
      case 404:
        // Private repositories answer 404 to anonymous reads.
        return authenticated
          ? classifiedCodeHostError('not_found', 'gitea.notFound')
          : classifiedCodeHostError('permission_denied', 'gitea.authRequired')
      case 422:
        return classifiedCodeHostError('validation_error', 'invalidRequest', detailOf(error))
      case 429:
        return classifiedCodeHostError('rate_limited', 'gitea.requestFailed', detailOf(error))
      default:
        return classifiedCodeHostError('unknown', 'gitea.requestFailed', detailOf(error))
    }
  }
  if (error instanceof TypeError) {
    return classifiedCodeHostError('network_error', 'networkError')
  }
  return classifiedCodeHostError('unknown', 'gitea.requestFailed', detailOf(error))
}
