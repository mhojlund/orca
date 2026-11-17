import { useEffectEvent, useId, useLayoutEffect, useState } from 'react'
import { ExternalLink, Eye, EyeOff, LoaderCircle, Lock } from 'lucide-react'
import { useMountedRef } from '@/hooks/useMountedRef'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { preventOutsideDismissWhenDirty } from '@/lib/overlay-interaction/outside-dismiss-guard'
import { giteaConnectErrorText } from '@/lib/source-control/remote/gitea-connect-error-copy'
import { openAppHttpLink } from '@/lib/browser/navigation/app-http-link-open'
import { useTranslate } from '@/i18n/use-translate'

type ConnectState = 'idle' | 'connecting' | 'error'

type GiteaInstanceDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Set when replacing the token of a stored instance; the URL is then fixed. */
  initialBaseUrl?: string | null
  lockBaseUrl?: boolean
  onConnected?: () => void
}

function tokenSettingsUrl(baseUrl: string): string | null {
  try {
    const url = new URL(
      baseUrl
        .trim()
        .replace(/\/+$/, '')
        .replace(/\/api\/v1$/i, '')
    )
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null
    }
    return `${url.origin}${url.pathname.replace(/\/+$/, '')}/user/settings/applications`
  } catch {
    return null
  }
}

export function GiteaInstanceDialog({
  open,
  onOpenChange,
  initialBaseUrl,
  lockBaseUrl = false,
  onConnected
}: GiteaInstanceDialogProps): React.JSX.Element {
  const t = useTranslate()
  const mountedRef = useMountedRef()
  const baseUrlId = useId()
  const tokenId = useId()
  const errorId = useId()
  const [baseUrl, setBaseUrl] = useState('')
  const [token, setToken] = useState('')
  const [showToken, setShowToken] = useState(false)
  const [connectState, setConnectState] = useState<ConnectState>('idle')
  const [connectError, setConnectError] = useState<string | null>(null)
  const [baselineUrl, setBaselineUrl] = useState('')

  // Keyed on `open` only, so a status refresh mid-edit cannot overwrite typing.
  const seed = useEffectEvent(() => {
    const seedUrl = initialBaseUrl ?? ''
    setBaselineUrl(seedUrl)
    setBaseUrl(seedUrl)
    setToken('')
    setConnectState('idle')
    setConnectError(null)
  })
  useLayoutEffect(() => {
    if (open) {
      seed()
    }
  }, [open])

  const connecting = connectState === 'connecting'
  const canSubmit = !connecting && Boolean(baseUrl.trim()) && Boolean(token.trim())
  const tokenUrl = tokenSettingsUrl(baseUrl)

  const clearErrorOnEdit = (): void => {
    if (connectState === 'error') {
      setConnectState('idle')
      setConnectError(null)
    }
  }

  const guardOutsideDismiss = preventOutsideDismissWhenDirty(
    () => token !== '' || baseUrl !== baselineUrl
  )

  const handleConnect = async (): Promise<void> => {
    if (!canSubmit) {
      return
    }
    setConnectState('connecting')
    setConnectError(null)
    try {
      const result = await window.api.gitea.instances.connect({
        baseUrl: baseUrl.trim(),
        token: token.trim()
      })
      if (!mountedRef.current) {
        return
      }
      if (result.ok) {
        setToken('')
        setConnectState('idle')
        onOpenChange(false)
        onConnected?.()
        return
      }
      setConnectState('error')
      setConnectError(giteaConnectErrorText(result))
    } catch (error) {
      if (mountedRef.current) {
        setConnectState('error')
        setConnectError(
          error instanceof Error
            ? error.message
            : t('auto.components.settings.gitea.instance.dialog.connectFailed', 'Connection failed')
        )
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !connecting && onOpenChange(next)}>
      <DialogContent
        scrollable
        className="sm:max-w-lg"
        onPointerDownOutside={guardOutsideDismiss}
        onInteractOutside={guardOutsideDismiss}
        onKeyDown={(event) => {
          if (event.target instanceof HTMLInputElement && event.key === 'Enter' && canSubmit) {
            event.preventDefault()
            void handleConnect()
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>
            {t('auto.components.settings.gitea.instance.dialog.title', 'Connect Gitea / Forgejo')}
          </DialogTitle>
          <DialogDescription>
            {t(
              'auto.components.settings.gitea.instance.dialog.description',
              'Use a personal access token to browse issues, pull requests and commit statuses on a Gitea or Forgejo instance. Orca verifies it before saving.'
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor={baseUrlId}>
              {t('auto.components.settings.gitea.instance.dialog.baseUrl', 'Instance URL')}
            </Label>
            <Input
              id={baseUrlId}
              autoFocus={!lockBaseUrl}
              placeholder={t(
                'auto.components.settings.gitea.instance.dialog.baseUrlPlaceholder',
                'https://codeberg.org'
              )}
              value={baseUrl}
              readOnly={lockBaseUrl}
              onChange={(event) => {
                setBaseUrl(event.target.value)
                clearErrorOnEdit()
              }}
              disabled={connecting}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={tokenId}>
              {t('auto.components.settings.gitea.instance.dialog.token', 'Personal access token')}
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id={tokenId}
                autoFocus={lockBaseUrl}
                type={showToken ? 'text' : 'password'}
                value={token}
                onChange={(event) => {
                  setToken(event.target.value)
                  clearErrorOnEdit()
                }}
                disabled={connecting}
                aria-invalid={connectState === 'error'}
                aria-describedby={connectState === 'error' ? errorId : undefined}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setShowToken((shown) => !shown)}
                aria-label={
                  showToken
                    ? t('settings.browser.passwords.hide', 'Hide password')
                    : t('settings.browser.passwords.show', 'Show password')
                }
              >
                {showToken ? <EyeOff /> : <Eye />}
              </Button>
            </div>
          </div>
          {connectState === 'error' && connectError ? (
            <p id={errorId} className="text-xs text-destructive">
              {connectError}
            </p>
          ) : null}
          <div className="space-y-2 text-xs leading-relaxed text-muted-foreground">
            <p>
              {t(
                'auto.components.settings.gitea.instance.dialog.scopesHint',
                'Grant read and write access to issues, read access to repositories and read access to your user. The instance is matched to a repository by hostname; if your git remote uses a different host, add that host as well.'
              )}
            </p>
            {tokenUrl ? (
              <button
                type="button"
                className="inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline"
                onClick={(event) => openAppHttpLink(tokenUrl, { event })}
              >
                <ExternalLink className="size-3" />
                {t('auto.components.settings.gitea.instance.dialog.createToken', 'Create a token')}
              </button>
            ) : null}
          </div>
          <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground/70">
            <Lock className="mt-0.5 size-3 shrink-0" />
            {t(
              'auto.components.settings.gitea.instance.dialog.storageNote',
              'Stored on this machine with encrypted storage when the OS keychain is available, and only sent to this instance. ORCA_GITEA_* environment variables apply to hosts without a saved instance.'
            )}
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={connecting}>
            {t('auto.components.settings.gitea.instance.dialog.cancel', 'Cancel')}
          </Button>
          <Button onClick={() => void handleConnect()} disabled={!canSubmit}>
            {connecting ? (
              <>
                <LoaderCircle className="size-4 animate-spin" />
                {t('auto.components.settings.gitea.instance.dialog.verifying', 'Verifying...')}
              </>
            ) : (
              t('auto.components.settings.gitea.instance.dialog.connect', 'Connect')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
