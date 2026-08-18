import { useEffect, useMemo, useState } from 'react'
import type { ReaderStatus, UiLanguage } from '@textreader/shared'
import { Logo } from '@/components/logo'
import {
  createTranslator,
  resolveUiLanguage,
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
  const [selectionEnabled, setSelectionEnabled] = useState(true)
  const [selectionSaving, setSelectionSaving] = useState(false)
  const [feedback, setFeedback] = useState('')

  useEffect(() => {
    void Promise.all([
      chrome.tabs.query({ active: true, currentWindow: true }),
      settingsService.get(),
      getActiveReaderState(),
    ])
      .then(([tabs, settings, response]) => {
        const nextTranslator = createTranslator(settings.uiLanguage)
        setPageTitle(tabs[0]?.title || nextTranslator('currentPage'))
        setTabId(tabs[0]?.id ?? null)
        setSelectionEnabled(settings.autoShowSelectionButton)
        setUiLanguage(settings.uiLanguage)
        if (response.ok && response.data) setStatus(response.data.status)
        document.documentElement.dataset.theme = settings.theme
        document.documentElement.lang = resolveUiLanguage(settings.uiLanguage)
      })
      .catch(() => setFeedback(createTranslator('auto')('unableToLoadSettings')))
  }, [])

  const toggleSelection = async () => {
    if (selectionSaving) return
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
    if (tabId === null) return
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
    <main className="w-[320px] max-w-full p-3.5">
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
          disabled={tabId === null}
          className="h-10 w-full rounded-xl bg-[var(--tr-accent)] text-[12px] font-semibold text-[var(--tr-accent-text)] disabled:opacity-50"
          onClick={() => void openReader()}
        >
          {t('openReader')}
        </button>
        <div className="mt-4 flex items-center justify-between border-t border-[var(--tr-border)] pt-3">
          <span className="text-[12px]">{t('selectionReading')}</span>
          <button
            type="button"
            role="switch"
            disabled={selectionSaving}
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
          <p className="mb-0 mt-3 text-[11px] text-[var(--tr-danger)]" role="alert">
            {feedback}
          </p>
        )}
      </div>
    </main>
  )
}
