import { useState } from 'react'
import type { TaskPageComposerActionsModel } from '../use-task-page-composer-actions'
import { useTranslate } from '@/i18n/use-translate'
import { useAppStore } from '@/store'
import { Button } from '@/components/ui/button'
import { GiteaItemRow } from './ItemRow'
import { GiteaInstanceDialog } from '@/components/integrations/source-control/gitea-instance-dialog'

const ISSUE_GRID = 'grid-cols-[80px_minmax(0,3fr)_120px_110px_50px]'
const PR_GRID = 'grid-cols-[80px_minmax(0,3fr)_90px_130px_120px_90px_110px_50px]'

export function TaskPageGiteaItemList({
  model
}: {
  model: TaskPageComposerActionsModel
}): React.JSX.Element {
  const t = useTranslate()
  const [connectOpen, setConnectOpen] = useState(false)
  const {
    giteaKind,
    giteaItems,
    giteaLoading,
    giteaError,
    giteaAuthRequired,
    refreshGiteaItems,
    selectedRepos,
    openGiteaDetailPage,
    handleUseGiteaItem
  } = model
  const grid = giteaKind === 'prs' ? PR_GRID : ISSUE_GRID
  const openItem = (item: (typeof giteaItems)[number]): void => {
    useAppStore.getState().recordFeatureInteraction('gitea-tasks')
    openGiteaDetailPage(item)
  }
  return (
    <div className="flex min-h-0 max-h-full flex-col rounded-md border border-t-0 border-border/50 bg-muted/50 overflow-hidden rounded-t-none shadow-sm">
      <div
        className={`flex-none grid ${grid} gap-3 border-b border-border/50 px-3 py-2 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground`}
      >
        <span>{t('auto.components.TaskPage.eb10c32872', 'ID')}</span>
        <span>{t('auto.components.TaskPage.16cba35bee', 'Title')}</span>
        {giteaKind === 'prs' ? (
          <>
            <span>{t('auto.components.TaskPage.f6fa3c97d0', 'Reviewers')}</span>
            <span>{t('auto.components.TaskPage.a7396b05c6', 'Checks')}</span>
            <span>{t('auto.components.TaskPage.443f7dd928', 'Merge')}</span>
          </>
        ) : null}
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
              <div key={i} className={`grid w-full gap-3 px-3 py-2 ${grid}`}>
                <div className="h-4 w-16 animate-pulse rounded bg-muted/70" />
                <div>
                  <div className="h-4 w-3/5 animate-pulse rounded bg-muted/70" />
                </div>
                {Array.from({ length: giteaKind === 'prs' ? 6 : 2 }).map((__, cell) => (
                  <div key={cell} className="h-3 w-20 animate-pulse rounded bg-muted/60" />
                ))}
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
                : giteaKind === 'prs'
                  ? t('auto.components.TaskPage.giteaEmptyPrsTitle', 'No Gitea pull requests')
                  : t('auto.components.TaskPage.giteaEmptyTitle', 'No Gitea issues')}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {selectedRepos.length === 0
                ? t(
                    'auto.components.taskPageEmptyState.noProjectSourcesDescription',
                    'Select at least one project source so Orca knows which host/account to fetch tasks from.'
                  )
                : giteaKind === 'prs'
                  ? t(
                      'auto.components.TaskPage.giteaEmptyPrsDescription',
                      'No Gitea or Forgejo pull requests match this filter.'
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
            <GiteaItemRow
              key={`${item.repoId}:${item.repoHostId ?? ''}:${item.id}`}
              item={item}
              grid={grid}
              onOpen={() => openItem(item)}
              onStart={() => handleUseGiteaItem(item)}
            />
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
