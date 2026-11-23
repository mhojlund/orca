let brandName: string | null = null

/** Null restores the stock name. Set once per process, before any UI text is produced. */
export function setAppBrandName(name: string | null): void {
  brandName = name
}

/** Rewrites the product name in user-visible text, including localized strings that embed it. */
export function brandText(text: string): string {
  if (!brandName || text.includes(brandName)) {
    return text
  }
  return text.replace(/\bOrca\b/g, brandName)
}
