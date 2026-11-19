import { useCallback, useEffect, useRef, useState } from 'react'
import { ExternalLink, GitPullRequestArrow, LoaderCircle, Unlink } from 'lucide-react'
import type {
  GiteaConnectionStatus,
  GiteaInstanceStatus
} from '../../../../../shared/gitea/gitea-instance-types'
import { Button } from '@/components/ui/button'
import { useMountedRef } from '@/hooks/useMountedRef'
import { readIpcErrorMessage } from '@/runtime/errors/ipc-error'
import { openAppHttpLink } from '@/lib/browser/navigation/app-http-link-open'
import { UnsealedCredentialNotice } from '../../provider-accounts/UnsealedCredentialNotice'
import {
  IntegrationCardDetails,
  IntegrationCardShell
} from '../presentation/integration-card-shell'
import { useIntegrationSubordinateRowClass } from '../presentation/integration-card-presentation'
import { usePreflightCardStatuses } from './source-control-preflight-card-status'
import { tokenProviderStatusLabel } from './token-source-control-status'
import { refreshGiteaInstanceHosts } from '@/lib/work-items/gitea/gitea-instance-hosts'
import { GiteaInstanceDialog } from './gitea-instance-dialog'
import { useTranslate } from '@/i18n/use-translate'

const API_DOCS_URL = 'https://docs.gitea.com/development/api-usage'

export function GiteaIntegrationCard(): React.JSX.Element {
  const t = useTranslate()
  const { statuses, unavailable, refresh } = usePreflightCardStatuses('gitea')
  const status = unavailable ? 'unavailable' : statuses.giteaStatus
  const mountedRef = useMountedRef()
  const rowClass = useIntegrationSubordinateRowClass('flex items-center gap-3')
  const [connection, setConnection] = useState<GiteaConnectionStatus | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [dialog, setDialog] = useState<{ open: boolean; baseUrl: string | null; lock: boolean }>({
    open: false,
    baseUrl: null,
    lock: false
  })
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [removeError, setRemoveError] = useState<string | null>(null)
  const loadGenerationRef = useRef(0)

  // Metadata only; mounting must not decrypt tokens or trigger keychain prompts.
  const loadConnection = useCallback(async () => {
    const generation = ++loadGenerationRef.current
    try {
      const next = await window.api.gitea.instances.status()
      if (mountedRef.current && generation === loadGenerationRef.current) {
        setConnection(next)
        setLoadFailed(false)
      }
    } catch {
      if (mountedRef.current && generation === loadGenerationRef.current) {
        setLoadFailed(true)
      }
    }
  }, [mountedRef])

  useEffect(() => {
    void loadConnection()
  }, [loadConnection])

  const instances = connection?.instances ?? []
  const envConfigured = connection?.environment.configured ?? false
  const configured = instances.length > 0 || status === 'configured'

  const reloadCardState = (): void => {
    void loadConnection()
    refresh()
  }

  const handleRemove = async (instance: GiteaInstanceStatus): Promise<void> => {
    setRemovingId(instance.id)
    setRemoveError(null)
    try {
      await window.api.gitea.instances.disconnect(instance.id)
      void refreshGiteaInstanceHosts()
    } catch (error) {
      if (mountedRef.current) {
        setRemoveError(
          readIpcErrorMessage(error) ??
            t(
              'auto.components.settings.gitea.integration.card.removeFailed',
              'Could not remove the saved instance.'
            )
        )
      }
    }
    if (mountedRef.current) {
      setRemovingId(null)
    }
    reloadCardState()
  }

  return (
    <IntegrationCardShell
      icon={<GitPullRequestArrow className="size-5" />}
      name="Gitea / Forgejo"
      description={t(
        'auto.components.settings.gitea.integration.card.description',
        'Issues, pull requests and commit statuses via the Gitea / Forgejo REST API.'
      )}
      checking={status === 'checking'}
      statusTone={configured ? 'connected' : 'attention'}
      statusLabel={tokenProviderStatusLabel(
        {
          configured,
          hasAccount: instances.some((instance) => instance.account),
          status,
          optional: true
        },
        t
      )}
      actions={
        status !== 'checking' ? (
          <Button
            variant={instances.length > 0 ? 'outline' : 'default'}
            size="sm"
            onClick={() => setDialog({ open: true, baseUrl: null, lock: false })}
          >
            {t('auto.components.settings.gitea.integration.card.addInstance', 'Add instance')}
          </Button>
        ) : null
      }
    >
      {status !== 'checking' ? (
        <IntegrationCardDetails>
          {instances.map((instance) => (
            <div key={instance.id} className="space-y-2">
              <UnsealedCredentialNotice
                protection={instance.credentialProtection}
                credentialName={t(
                  'auto.components.settings.gitea.integration.card.credentialName',
                  'Your {{value0}} token',
                  { value0: instance.host }
                )}
              />
              <div className={rowClass}>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{instance.host}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[
                      instance.account,
                      instance.serverKind === 'forgejo' ? 'Forgejo' : 'Gitea',
                      instance.serverVersion
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setDialog({ open: true, baseUrl: instance.webBaseUrl, lock: true })
                  }
                >
                  {t('auto.components.settings.gitea.integration.card.editToken', 'Edit token')}
                </Button>
                <button
                  onClick={() => void handleRemove(instance)}
                  disabled={removingId === instance.id}
                  aria-label={t(
                    'auto.components.settings.gitea.integration.card.remove',
                    'Remove {{value0}}',
                    { value0: instance.host }
                  )}
                  className="rounded-md p-1 text-muted-foreground/50 transition-colors hover:text-destructive"
                >
                  {removingId === instance.id ? (
                    <LoaderCircle className="size-3.5 animate-spin" />
                  ) : (
                    <Unlink className="size-3.5" />
                  )}
                </button>
              </div>
            </div>
          ))}
          {removeError ? <p className="text-xs text-destructive">{removeError}</p> : null}
          {loadFailed ? (
            <p role="alert" className="text-xs text-destructive">
              {t(
                'auto.components.settings.gitea.integration.card.statusLoadFailed',
                'Could not check for saved Gitea / Forgejo instances.'
              )}
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            {status === 'unavailable'
              ? t(
                  'auto.components.settings.token.source.control.integration.cards.0613928cb3',
                  'Gitea status is not available in this runtime yet.'
                )
              : status === 'not-authenticated'
                ? t(
                    'auto.components.settings.gitea.integration.card.authFailed',
                    'The ORCA_GITEA_TOKEN environment credential could not authenticate. Check the token and API base URL, then restart Orca.'
                  )
                : envConfigured
                  ? t(
                      'auto.components.settings.gitea.integration.card.envNote',
                      'ORCA_GITEA_* environment variables apply to hosts without a saved instance.'
                    )
                  : instances.length > 0
                    ? t(
                        'auto.components.settings.gitea.integration.card.storedNote',
                        'Each token is saved on this machine and only sent to its own instance.'
                      )
                    : t(
                        'auto.components.settings.gitea.integration.card.notConfigured',
                        'Public repositories are detected from their git remote. Add an instance with a personal access token for private repositories and issues.'
                      )}
          </p>
          <div className="flex items-center gap-2">
            {!configured ? (
              <Button
                variant="outline"
                size="sm"
                onClick={(event) => openAppHttpLink(API_DOCS_URL, { event })}
              >
                <ExternalLink className="mr-1.5 size-3.5" />
                {t(
                  'auto.components.settings.token.source.control.integration.cards.1a9475dace',
                  'Learn more'
                )}
              </Button>
            ) : null}
            <Button variant="ghost" size="sm" onClick={reloadCardState}>
              {t(
                'auto.components.settings.token.source.control.integration.cards.793a06e899',
                'Re-check'
              )}
            </Button>
          </div>
        </IntegrationCardDetails>
      ) : null}
      <GiteaInstanceDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((current) => ({ ...current, open }))}
        initialBaseUrl={dialog.baseUrl}
        lockBaseUrl={dialog.lock}
        onConnected={reloadCardState}
      />
    </IntegrationCardShell>
  )
}
