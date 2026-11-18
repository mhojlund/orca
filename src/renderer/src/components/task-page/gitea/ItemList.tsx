import { useState } from 'react'
import type { TaskPageComposerActionsModel } from '../use-task-page-composer-actions'
import { useIntlLocale, useTranslate } from '@/i18n/use-translate'
import { useAppStore } from '@/store'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { ArrowRight, ExternalLink } from 'lucide-react'
import { openAppHttpLink } from '@/lib/browser/navigation/app-http-link-open'
import { GiteaInstanceDialog } from '@/components/integrations/source-control/gitea-instance-dialog'

const GRID = 'grid-cols-[80px_minmax(0,3fr)_120px_110px_50px]'

export function TaskPageGiteaItemList({
  model
}: {
  model: TaskPageComposerActionsModel
}): React.JSX.Element {
  const t = useTranslate()
  const intlLocale = useIntlLocale()
  const [connectOpen, setConnectOpen] = useState(false)
  const {
    giteaItems,
    giteaLoading,
    giteaError,
    giteaAuthRequired,
    refreshGiteaItems,
    selectedRepos,
    openGiteaDetailPage,
    handleUseGiteaItem
  } = model
  const openItem = (item: (typeof giteaItems)[number]): void => {
    useAppStore.getState().recordFeatureInteraction('gitea-tasks')
    openGiteaDetailPage(item)
  }
  return (
    <div className="flex min-h-0 max-h-full flex-col rounded-md border border-t-0 border-border/50 bg-muted/50 overflow-hidden rounded-t-none shadow-sm">
      <div
        className={`flex-none grid ${GRID} gap-3 border-b border-border/50 px-3 py-2 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground`}
      >
        <span>{t('auto.components.TaskPage.eb10c32872', 'ID')}</span>
        <span>{t('auto.components.TaskPage.16cba35bee', 'Title')}</span>
        <span>{t('auto.components.TaskPage.giteaState', 'State')}</span>
        <span>{t('auto.components.TaskPage.f362667d55', 'Updated')}</span>
        <span />
      </div>
      <div
        className="min-h-0 flex-initial overflow-y-auto scrollbar-sleek"
        style={{ scrollbarGutter: 'stable' }}
      >
        {giteaError ? (
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-4 text-sm text-destructive">
            <span>{giteaError}</span>
            {giteaAuthRequired ? (
              <Button size="sm" variant="outline" onClick={() => setConnectOpen(true)}>
                {t('auto.components.TaskPage.giteaConnect', 'Connect Gitea/Forgejo')}
              </Button>
            ) : null}
          </div>
        ) : null}
        {giteaLoading && giteaItems.length === 0 ? (
          <div className="divide-y divide-border/50">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className={`grid w-full gap-3 px-3 py-2 ${GRID}`}>
                <div className="h-4 w-16 animate-pulse rounded bg-muted/70" />
                <div>
                  <div className="h-4 w-3/5 animate-pulse rounded bg-muted/70" />
                </div>
                <div className="h-3 w-20 animate-pulse rounded bg-muted/60" />
                <div className="h-3 w-20 animate-pulse rounded bg-muted/60" />
                <div />
              </div>
            ))}
          </div>
        ) : null}
        {!giteaLoading && giteaItems.length === 0 && !giteaError ? (
          <div className="px-4 py-12 text-center">
            <p className="text-base font-medium text-foreground">
              {selectedRepos.length === 0
                ? t(
                    'auto.components.taskPageEmptyState.noProjectSourcesTitle',
                    'No project sources selected'
                  )
                : t('auto.components.TaskPage.giteaEmptyTitle', 'No Gitea issues')}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {selectedRepos.length === 0
                ? t(
                    'auto.components.taskPageEmptyState.noProjectSourcesDescription',
                    'Select at least one project source so Orca knows which host/account to fetch tasks from.'
                  )
                : t(
                    'auto.components.TaskPage.giteaEmptyDescription',
                    'No Gitea or Forgejo issues match this filter.'
                  )}
            </p>
          </div>
        ) : null}
        <div className="divide-y divide-border/50">
          {giteaItems.map((item) => (
            // Why: div role="button" not a <button> — it nests an open-in-browser button, and button-in-button is invalid HTML.
            <div
              role="button"
              tabIndex={0}
              key={`${item.repoId}:${item.repoHostId ?? ''}:${item.id}`}
              onClick={() => openItem(item)}
              onKeyDown={(e) => {
                if (e.target !== e.currentTarget) {
                  return
                }
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  openItem(item)
                }
              }}
              className={`grid w-full cursor-pointer gap-3 px-3 py-2 text-left ${GRID} hover:bg-muted/50`}
            >
              <span className="font-mono text-xs text-muted-foreground">#{item.number}</span>
              <span className="min-w-0 truncate text-sm">{item.title}</span>
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
                        handleUseGiteaItem(item)
                      }}
                      aria-label={t(
                        'auto.components.TaskPage.startWorkspaceFromIssue',
                        'Start workspace from issue {{number}}',
                        { number: item.number }
                      )}
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
          ))}
        </div>
      </div>
      <GiteaInstanceDialog
        open={connectOpen}
        onOpenChange={setConnectOpen}
        onConnected={refreshGiteaItems}
      />
    </div>
  )
}
