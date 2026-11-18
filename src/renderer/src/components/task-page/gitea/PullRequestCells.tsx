import { GitMerge } from 'lucide-react'
import type { GitHubWorkItem } from '../../../../../shared/github/work-items/work-item-types'
import {
  getGitHubPRPrimaryReviewer,
  getGitHubPRReviewerRows,
  getGitHubPRReviewLabel
} from '../../../../../shared/github/pull-requests/pr-reviewer-display'
import { presentGitHubPRMergeState } from '@/components/github/github-pr-merge-state'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useTranslate } from '@/i18n/use-translate'
import { cn } from '@/lib/class-names'
import { ReviewChipAvatar } from '../github/listing/Avatars'

export function GiteaPrReviewCell({ item }: { item: GitHubWorkItem }): React.JSX.Element {
  const primary = getGitHubPRPrimaryReviewer(item)
  const extra = Math.max(0, getGitHubPRReviewerRows(item).length - 1)
  if (!primary) {
    return <span aria-hidden="true">-</span>
  }
  return (
    <span
      className="inline-flex items-center gap-1"
      title={getGitHubPRReviewLabel(item)}
      aria-label={getGitHubPRReviewLabel(item)}
    >
      <ReviewChipAvatar reviewer={primary} avatarHost={item.prRepo?.host} />
      {extra > 0 ? (
        <span className="text-[10px] tabular-nums text-muted-foreground">+{extra}</span>
      ) : null}
    </span>
  )
}

/** Read-only: Orca does not merge Gitea PRs, so there is no merge menu. */
export function GiteaPrMergeCell({ item }: { item: GitHubWorkItem }): React.JSX.Element {
  const t = useTranslate()
  const presentation = presentGitHubPRMergeState(item, t)
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            'inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium',
            presentation.tone
          )}
        >
          <GitMerge className="size-3" />
          <span className="truncate">{presentation.label}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={6}>
        {presentation.tooltip}
      </TooltipContent>
    </Tooltip>
  )
}
