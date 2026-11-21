import { useState } from 'react'
import type { GitHubWorkItem } from '../../../../../shared/github/work-items/work-item-types'
import type {
  GiteaInvolvementFilter,
  GiteaKindFilter,
  GiteaStateFilter
} from './gitea-task-filters'

export function useTaskPageGiteaState() {
  const [giteaKind, setGiteaKind] = useState<GiteaKindFilter>('issues')
  const [giteaState, setGiteaState] = useState<GiteaStateFilter>('open')
  const [giteaInvolvement, setGiteaInvolvement] = useState<GiteaInvolvementFilter>('everyone')
  const [giteaItems, setGiteaItems] = useState<GitHubWorkItem[]>([])
  const [giteaListQueryKey, setGiteaListQueryKey] = useState<string | null>(null)
  const [giteaLoading, setGiteaLoading] = useState(false)
  const [giteaError, setGiteaError] = useState<string | null>(null)
  const [giteaAuthRequired, setGiteaAuthRequired] = useState(false)
  const [giteaRefreshNonce, setGiteaRefreshNonce] = useState(0)
  // Keep the dialog target outside the list so refresh cannot remove its context.
  const [giteaDialogItem, setGiteaDialogItem] = useState<GitHubWorkItem | null>(null)
  return {
    giteaKind,
    setGiteaKind,
    giteaState,
    setGiteaState,
    giteaInvolvement,
    setGiteaInvolvement,
    giteaItems,
    setGiteaItems,
    giteaListQueryKey,
    setGiteaListQueryKey,
    giteaLoading,
    setGiteaLoading,
    giteaError,
    setGiteaError,
    giteaAuthRequired,
    setGiteaAuthRequired,
    giteaRefreshNonce,
    refreshGiteaItems: () => setGiteaRefreshNonce((nonce) => nonce + 1),
    giteaDialogItem,
    setGiteaDialogItem
  }
}

export type TaskPageGiteaState = ReturnType<typeof useTaskPageGiteaState>
