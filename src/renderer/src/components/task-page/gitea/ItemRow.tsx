import { ArrowRight, ExternalLink } from 'lucide-react'
import type { GitHubWorkItem } from '../../../../../shared/github/work-items/work-item-types'
import { PRChecksCell } from '../github/pull-requests/ChecksCell'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { openAppHttpLink } from '@/lib/browser/navigation/app-http-link-open'
import { useIntlLocale, useTranslate } from '@/i18n/use-translate'
import { GiteaPrMergeCell, GiteaPrReviewCell } from './PullRequestCells'

const noop = (): void => {}

export function GiteaItemRow({
  item,
  grid,
  onOpen,
  onStart
}: {
  item: GitHubWorkItem
  grid: string
  onOpen: () => void
  onStart: () => void
}): React.JSX.Element {
  const t = useTranslate()
  const intlLocale = useIntlLocale()
  const isPr = item.type === 'pr'
  return (
    // Why: div role="button" not a <button> — it nests an open-in-browser button, and button-in-button is invalid HTML.
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) {
          return
        }
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen()
        }
      }}
      className={`grid w-full cursor-pointer items-center gap-3 px-3 py-2 text-left ${grid} hover:bg-muted/50`}
    >
      <span className="font-mono text-xs text-muted-foreground">#{item.number}</span>
      <span className="min-w-0 truncate text-sm">{item.title}</span>
      {isPr ? (
        <>
          <GiteaPrReviewCell item={item} />
          <PRChecksCell item={item} onOpen={onOpen} onLoadChecks={noop} />
          <GiteaPrMergeCell item={item} />
        </>
      ) : null}
      <span className="text-xs text-muted-foreground">{item.state}</span>
      <span className="text-xs text-muted-foreground">
        {item.updatedAt ? new Date(item.updatedAt).toLocaleDateString(intlLocale) : ''}
      </span>
      <div className="flex items-center justify-end gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              data-contextual-tour-target="tasks-start-workspace"
              onClick={(event) => {
                event.stopPropagation()
                onStart()
              }}
              aria-label={
                isPr
                  ? t(
                      'auto.components.TaskPage.giteaStartFromPr',
                      'Start workspace from PR {{number}}',
                      { number: item.number }
                    )
                  : t(
                      'auto.components.TaskPage.startWorkspaceFromIssue',
                      'Start workspace from issue {{number}}',
                      { number: item.number }
                    )
              }
            >
              <ArrowRight className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={6}>
            {t('auto.components.TaskPage.9497f2787c', 'Start workspace')}
          </TooltipContent>
        </Tooltip>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            openAppHttpLink(item.url, { event: e })
          }}
          aria-label={t('auto.components.TaskPage.giteaOpenInBrowser', 'Open in Gitea')}
          className="text-muted-foreground hover:text-foreground"
        >
          <ExternalLink className="size-3.5" />
        </button>
      </div>
    </div>
  )
}
