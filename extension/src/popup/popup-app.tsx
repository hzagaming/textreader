import { useEffect, useMemo, useState } from 'react'
import type { ReaderStatus, UiLanguage } from '@textreader/shared'
import { Logo } from '@/components/logo'
import {
  createTranslator,
  resolveUiLanguage,
  translateErrorCode,
  type MessageKey,
} from '@/services/i18n/i18n'
import { getActiveReaderState, sendRuntimeMessage } from '@/services/messaging/transport'
import { settingsService } from '@/services/settings/settings'

export function PopupApp() {
  const [uiLanguage, setUiLanguage] = useState<UiLanguage>('auto')
  const t = useMemo(() => createTranslator(uiLanguage), [uiLanguage])
  const [pageTitle, setPageTitle] = useState(() => t('currentPage'))
  const [tabId, setTabId] = useState<number | null>(null)
  const [status, setStatus] = useState<ReaderStatus>('idle')
  const [readerConnected, setReaderConnected] = useState(false)
  const [selectionEnabled, setSelectionEnabled] = useState(true)
  const [selectionSaving, setSelectionSaving] = useState(false)
  const [settingsLoaded, setSettingsLoaded] = useState(false)
  const [feedback, setFeedback] = useState('')

  useEffect(() => {
    let active = true
    void Promise.allSettled([
      chrome.tabs.query({ active: true, currentWindow: true }),
      settingsService.get(),
      getActiveReaderState(),
    ]).then(([tabsResult, settingsResult, readerResult]) => {
      if (!active) return
      const settings =
        settingsResult.status === 'fulfilled' ? settingsResult.value : undefined
      const nextTranslator = createTranslator(settings?.uiLanguage ?? 'auto')

      if (tabsResult.status === 'fulfilled') {
        setPageTitle(tabsResult.value[0]?.title || nextTranslator('currentPage'))
        setTabId(tabsResult.value[0]?.id ?? null)
      } else {
        setPageTitle(nextTranslator('currentPage'))
      }

      if (settings) {
        setSelectionEnabled(settings.autoShowSelectionButton)
        setUiLanguage(settings.uiLanguage)
        document.documentElement.dataset.theme = settings.theme
        document.documentElement.lang = resolveUiLanguage(settings.uiLanguage)
        setSettingsLoaded(true)
      }

      if (
        readerResult.status === 'fulfilled' &&
        readerResult.value.ok &&
        readerResult.value.data
      ) {
        setStatus(readerResult.value.data.status)
      } else if (readerResult.status === 'fulfilled' && !readerResult.value.ok) {
        setStatus('error')
      }
      setReaderConnected(readerResult.status === 'fulfilled' && readerResult.value.ok)

      const requestFailed =
        tabsResult.status === 'rejected' ||
        settingsResult.status === 'rejected' ||
        readerResult.status === 'rejected'
      setFeedback(
        requestFailed
          ? nextTranslator('unableToLoadSettings')
          : readerResult.value.ok
            ? ''
            : translateErrorCode(readerResult.value.error.code, nextTranslator),
      )
    })
    return () => {
      active = false
    }
  }, [])

  const toggleSelection = async () => {
    if (!settingsLoaded || selectionSaving) return
    setSelectionSaving(true)
    try {
      const settings = await settingsService.update({
        autoShowSelectionButton: !selectionEnabled,
      })
      setSelectionEnabled(settings.autoShowSelectionButton)
      setFeedback('')
    } catch {
      setFeedback(t('unableToSaveSetting'))
    } finally {
      setSelectionSaving(false)
    }
  }

  const statusKey: Record<ReaderStatus, MessageKey> = {
    idle: 'statusIdle',
    loading: 'statusLoading',
    playing: 'statusPlaying',
    paused: 'statusPaused',
    stopped: 'statusStopped',
    error: 'statusError',
  }

  const openReader = async () => {
    if (tabId === null || !readerConnected) return
    const response = await sendRuntimeMessage({
      type: 'OPEN_SIDE_PANEL',
      payload: { tabId },
    })
    if (response.ok) {
      window.close()
      return
    }
    setFeedback(t('unableToContactPage'))
  }

  return (
    <main className="tr-app-enter w-[320px] max-w-full p-3.5">
      <div className="rounded-[18px] border border-[var(--tr-border)] bg-[var(--tr-surface)] p-4 shadow-sm">
        <Logo />
        <div className="my-4 rounded-xl bg-[var(--tr-soft)] p-3">
          <p className="m-0 truncate text-[12px] font-medium" title={pageTitle}>
            {pageTitle}
          </p>
          <p className="mb-0 mt-1 text-[11px] capitalize text-[var(--tr-muted)]">
            {t(statusKey[status])}
          </p>
        </div>
        <button
          type="button"
          disabled={tabId === null || !readerConnected}
          className="h-10 w-full rounded-xl bg-[var(--tr-accent)] text-[12px] font-semibold text-[var(--tr-accent-text)] transition-transform active:scale-[0.985] disabled:opacity-50"
          onClick={() => void openReader()}
        >
          {t('openReader')}
        </button>
        <div className="mt-4 flex items-center justify-between border-t border-[var(--tr-border)] pt-3">
          <span className="text-[12px]">{t('selectionReading')}</span>
          <button
            type="button"
            role="switch"
            disabled={!settingsLoaded || selectionSaving}
            aria-checked={selectionEnabled}
            aria-label={t('toggleSelectionReading')}
            className={`relative h-6 w-10 rounded-full transition ${selectionEnabled ? 'bg-[var(--tr-accent)]' : 'bg-[var(--tr-soft)]'}`}
            onClick={() => void toggleSelection()}
          >
            <span
              className={`absolute top-1 size-4 rounded-full bg-white shadow-sm transition ${selectionEnabled ? 'left-5' : 'left-1'}`}
            />
          </button>
        </div>
        {feedback && (
          <p
            className="tr-toast-enter mb-0 mt-3 text-[11px] text-[var(--tr-danger)]"
            role="alert"
          >
            {feedback}
          </p>
        )}
      </div>
    </main>
  )
}
