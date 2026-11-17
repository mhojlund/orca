import type { TaskPageComposerActionsModel } from '../use-task-page-composer-actions'
import { useTranslate } from '@/i18n/use-translate'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { LoaderCircle, RefreshCw } from 'lucide-react'
import { TaskPageFilterChip } from '../TaskPageFilterChip'
import { TaskPageRepoPicker } from '../TaskPageRepoPicker'
import {
  GITEA_INVOLVEMENT_FILTERS,
  GITEA_STATE_FILTERS,
  type GiteaInvolvementFilter,
  type GiteaStateFilter
} from './gitea-task-filters'

export function TaskPageGiteaFilters({
  model
}: {
  model: TaskPageComposerActionsModel
}): React.JSX.Element {
  const t = useTranslate()
  const {
    giteaState,
    setGiteaState,
    giteaInvolvement,
    setGiteaInvolvement,
    giteaLoading,
    refreshGiteaItems
  } = model
  const stateLabels: Record<GiteaStateFilter, string> = {
    open: t('auto.components.TaskPage.giteaStateOpen', 'Open'),
    closed: t('auto.components.TaskPage.giteaStateClosed', 'Closed'),
    all: t('auto.components.TaskPage.giteaStateAll', 'All')
  }
  const involvementLabels: Record<GiteaInvolvementFilter, string> = {
    everyone: t('auto.components.TaskPage.giteaInvolvementEveryone', 'Everyone'),
    assigned: t('auto.components.TaskPage.giteaInvolvementAssigned', 'Assigned to me'),
    created: t('auto.components.TaskPage.giteaInvolvementCreated', 'Created by me')
  }
  const refreshLabel = t('auto.components.TaskPage.giteaRefresh', 'Refresh Gitea issues')
  return (
    <>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <TaskPageRepoPicker model={model} />
      </div>
      <div
        className="min-w-0 rounded-md rounded-b-none border border-border/50 bg-muted/50 px-3 pt-2 pb-0 shadow-sm"
        data-contextual-tour-target="tasks-search-presets"
      >
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <div className="flex flex-wrap gap-2">
              {GITEA_STATE_FILTERS.map((id) => (
                <TaskPageFilterChip
                  key={id}
                  label={stateLabels[id]}
                  active={giteaState === id}
                  onSelect={() => setGiteaState(id)}
                />
              ))}
            </div>
            <span aria-hidden className="h-4 w-px bg-border/60" />
            <div className="flex flex-wrap gap-2">
              {GITEA_INVOLVEMENT_FILTERS.map((id) => (
                <TaskPageFilterChip
                  key={id}
                  label={involvementLabels[id]}
                  active={giteaInvolvement === id}
                  onSelect={() => setGiteaInvolvement(id)}
                />
              ))}
            </div>
          </div>
          <div
            className="flex shrink-0 items-center gap-2"
            data-contextual-tour-target="tasks-actions"
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={refreshGiteaItems}
                  disabled={giteaLoading}
                  aria-label={refreshLabel}
                  className="border-border/50 bg-transparent hover:bg-muted/50 backdrop-blur-md supports-[backdrop-filter]:bg-transparent"
                >
                  {giteaLoading ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : (
                    <RefreshCw className="size-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={6}>
                {refreshLabel}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
    </>
  )
}
