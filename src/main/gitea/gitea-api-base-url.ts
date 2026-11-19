export function normalizeGiteaApiBaseUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, '')
  return /\/api\/v1$/i.test(trimmed) ? trimmed : `${trimmed}/api/v1`
}

/** Returns the instance web base URL (no trailing slash, no /api/v1), or null when not http(s). */
export function normalizeGiteaWebBaseUrl(value: string): string | null {
  const trimmed = value
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/api\/v1$/i, '')
  try {
    const url = new URL(trimmed)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null
    }
    return `${url.protocol}//${url.host.toLowerCase()}${url.pathname.replace(/\/+$/, '')}`
  } catch {
    return null
  }
}
