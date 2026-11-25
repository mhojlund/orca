import type { TaskPageComposerActionsModel } from './use-task-page-composer-actions'
import '../github-item-dialog/load-item-details/work-item-details-cache'
import PullRequestPage from '@/components/pull-request-page/page/surface'
import GitHubItemDialog from '@/components/github-item-dialog/open-dialog/github-item-dialog'
import { useTranslate } from '@/i18n/use-translate'
import ProjectViewWrapper from '@/components/github-project/ProjectViewWrapper'
import { TaskPageGitHubList } from './github/listing/List'
import { TaskPageGitLabTodoList } from './gitlab/TodoList'
import { TaskPageGitLabItemList } from './gitlab/ItemList'
import { TaskPageGiteaItemList } from './gitea/ItemList'
import { getTaskPageRepoSourceContext } from '@/lib/work-items/task-repo-source-context'
import { getWorkItemRepo } from '@/lib/work-items/work-item-repo-row'
import { TaskPageJiraContent } from './jira/Content'
export function TaskPageContent({
  model
}: {
  model: TaskPageComposerActionsModel
}): React.JSX.Element | null {
  const t = useTranslate()
  const {
    repoSelection,
    taskSource,
    githubMode,
    gitlabView,
    giteaDialogItem,
    setGiteaDialogItem,
    handleUseGiteaItem,
    repos,
    dialogInitialTab,
    dialogWorkItem,
    dialogRepoPath,
    dialogSourceContext,
    accountBackedTaskSourceHostId,
    setDialogWorkItem,
    handleDialogReviewRequestsChange,
    closeTaskDetailPage,
    handleUseWorkItem
  } = model
  return taskSource === 'github' && dialogWorkItem ? (
    dialogWorkItem.type === 'pr' ? (
      <PullRequestPage
        workItem={dialogWorkItem}
        initialTab={dialogInitialTab}
        repoPath={dialogRepoPath}
        repoId={dialogWorkItem.repoId}
        sourceContext={dialogSourceContext}
        backLabel={t('auto.components.TaskPage.backToPullRequests', 'Pull requests')}
        onUse={(item) => {
          setDialogWorkItem(null)
          handleUseWorkItem(item)
        }}
        onReviewRequestsChange={handleDialogReviewRequestsChange}
        onClose={closeTaskDetailPage}
      />
    ) : (
      <GitHubItemDialog
        workItem={dialogWorkItem}
        initialTab={dialogInitialTab}
        repoPath={dialogRepoPath}
        repoId={dialogWorkItem.repoId}
        sourceContext={dialogSourceContext}
        backLabel={t('auto.components.TaskPage.backToGitHubList', 'GitHub list')}
        onUse={(item) => {
          setDialogWorkItem(null)
          handleUseWorkItem(item)
        }}
        onReviewRequestsChange={handleDialogReviewRequestsChange}
        onClose={closeTaskDetailPage}
      />
    )
  ) : taskSource === 'github' && githubMode === 'project' ? (
    <div className="mt-3 flex min-h-0 min-w-0 max-h-full flex-col overflow-hidden rounded-md border border-border/50 bg-muted/50 shadow-sm">
      <ProjectViewWrapper
        selectedRepoIds={repoSelection}
        sourceHostId={accountBackedTaskSourceHostId}
      />
    </div>
  ) : taskSource === 'github' ? (
    // Join the table shell to the filter chrome without a doubled seam.
    <TaskPageGitHubList model={model} />
  ) : taskSource === 'gitea' && giteaDialogItem ? (
    <GitHubItemDialog
      workItem={giteaDialogItem}
      initialTab="conversation"
      repoPath={getWorkItemRepo(repos, giteaDialogItem)?.path ?? null}
      repoId={giteaDialogItem.repoId}
      sourceContext={getTaskPageRepoSourceContext(getWorkItemRepo(repos, giteaDialogItem), 'gitea')}
      backLabel={t('auto.components.TaskPage.backToGiteaList', 'Gitea list')}
      onUse={(item) => {
        setGiteaDialogItem(null)
        handleUseGiteaItem(item)
      }}
      onClose={() => setGiteaDialogItem(null)}
    />
  ) : taskSource === 'gitea' ? (
    <TaskPageGiteaItemList model={model} />
  ) : taskSource === 'gitlab' && gitlabView === 'todos' ? (
    <TaskPageGitLabTodoList model={model} />
  ) : taskSource === 'gitlab' ? (
    <TaskPageGitLabItemList model={model} />
  ) : (
    <TaskPageJiraContent model={model} />
  )
}
