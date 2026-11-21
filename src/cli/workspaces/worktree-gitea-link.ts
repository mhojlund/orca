import type { RuntimeReferenceListResult } from '../../shared/workspace-attachments/runtime-reference-contracts'
import {
  getWorkspaceReferenceIdentity,
  parseWorkspaceReferenceUrl
} from '../../shared/workspace-attachments/workspace-reference-identity'
import type { WorkspaceAttachment } from '../../shared/worktree/types'
import { assertReferenceWritesSupported } from '../references/reference-input'
import type { RuntimeClient } from '../runtime/client'
import { RuntimeClientError } from '../runtime/connection/types'
import { getOptionalWorktreeLinkFlagValue } from './worktree-link-flag-value'

const BAD_VALUE =
  'Pass a Gitea or Forgejo issue number like 42 or #42, an issue URL, or null to clear --gitea-issue.'

/** A number or URL becomes a Gitea issue attachment; null (set only) clears the link. */
export function getOptionalGiteaIssueFlag(
  flags: Map<string, string | boolean>,
  options: { allowNull?: boolean } = {}
): WorkspaceAttachment | null | undefined {
  const value = getOptionalWorktreeLinkFlagValue(flags, 'gitea-issue', {
    ...options,
    createHint: 'a Gitea or Forgejo issue number or URL'
  })
  if (value == null) {
    return value
  }
  const trimmed = value.trim()
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const item = parseWorkspaceReferenceUrl(trimmed, 'gitea')
      if (item.type === 'issue') {
        return item
      }
    } catch {
      // Falls through to the shared invalid-value error.
    }
    throw new RuntimeClientError('invalid_argument', BAD_VALUE)
  }
  const digits = trimmed.startsWith('#') ? trimmed.slice(1) : trimmed
  const number = /^\d+$/.test(digits) ? Number.parseInt(digits, 10) : 0
  if (!Number.isSafeInteger(number) || number <= 0) {
    throw new RuntimeClientError('invalid_argument', BAD_VALUE)
  }
  return { provider: 'gitea', type: 'issue', number }
}

/** Merges the Gitea issue link into create's reference attachments, deduplicated by identity. */
export function mergeGiteaIssueIntoLinkedItems(
  linkedItems: WorkspaceAttachment[] | undefined,
  giteaIssue: WorkspaceAttachment | null | undefined
): WorkspaceAttachment[] | undefined {
  if (!giteaIssue) {
    return linkedItems
  }
  const merged = new Map(
    (linkedItems ?? []).map((item) => [getWorkspaceReferenceIdentity(item), item])
  )
  merged.set(getWorkspaceReferenceIdentity(giteaIssue), giteaIssue)
  return [...merged.values()]
}

/** Builds worktree.set fields that replace the workspace's Gitea issue link, or clear it for null. */
export async function buildGiteaIssueSetFields(
  client: RuntimeClient,
  worktree: string,
  giteaIssue: WorkspaceAttachment | null
): Promise<{
  linkedItemsBase: WorkspaceAttachment[]
  linkedItems: WorkspaceAttachment[]
  linkedItemsSelectionChanged: false
}> {
  await assertReferenceWritesSupported(client)
  const { result } = await client.call<RuntimeReferenceListResult>('reference.list', { worktree })
  const base = result.references.map(({ key: _key, selected: _selected, ...item }) => item)
  const isGiteaIssue = (item: WorkspaceAttachment): boolean =>
    item.provider === 'gitea' && item.type === 'issue'
  const kept = base.filter((item) => !isGiteaIssue(item))
  return {
    linkedItemsBase: base,
    linkedItems: giteaIssue ? [...kept, giteaIssue] : kept,
    linkedItemsSelectionChanged: false
  }
}
