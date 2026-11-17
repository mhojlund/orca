export class HostedReviewApiRequestError extends Error {
  readonly status: number | null
  readonly timedOut: boolean

  constructor(message: string, options: { status?: number | null; timedOut?: boolean } = {}) {
    super(message)
    this.name = 'HostedReviewApiRequestError'
    this.status = options.status ?? null
    this.timedOut = options.timedOut ?? false
  }
}

async function readResponseText(response: Response): Promise<string> {
  try {
    return await response.text()
  } catch {
    return ''
  }
}

export type HostedReviewApiResponse<T> = { data: T | null; headers: Headers }

/** Like requestHostedReviewJson, but keeps headers (pagination totals) and allows empty 204 bodies. */
export async function requestHostedReviewResponse<T>(
  url: URL,
  init: Omit<RequestInit, 'signal'>,
  timeoutMs: number
): Promise<HostedReviewApiResponse<T>> {
  try {
    const response = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) })
    if (!response.ok) {
      const body = await readResponseText(response)
      throw new HostedReviewApiRequestError(body || response.statusText, {
        status: response.status
      })
    }
    const text = await readResponseText(response)
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: callers name the provider's documented response shape; this layer only transports it.
    return { data: text ? (JSON.parse(text) as T) : null, headers: response.headers }
  } catch (error) {
    if (error instanceof HostedReviewApiRequestError) {
      throw error
    }
    // AbortSignal.timeout() rejects with a TimeoutError, not an AbortError.
    if (error instanceof Error && error.name === 'TimeoutError') {
      throw new HostedReviewApiRequestError('Request timed out', { timedOut: true })
    }
    throw error
  }
}

export async function requestHostedReviewJson<T>(
  url: URL,
  init: Omit<RequestInit, 'signal'>,
  timeoutMs: number
): Promise<T> {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: preserves this helper's prior contract, where callers expect a JSON body.
  return (await requestHostedReviewResponse<T>(url, init, timeoutMs)).data as T
}
