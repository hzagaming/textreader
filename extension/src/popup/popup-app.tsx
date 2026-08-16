import { useEffect, useState } from 'react'
import { Logo } from '@/components/logo'
import { getActiveReaderState, sendRuntimeMessage } from '@/services/messaging/transport'
import { settingsService } from '@/services/settings/settings'

export function PopupApp() {
  const [pageTitle, setPageTitle] = useState('Current page')
  const [tabId, setTabId] = useState<number | null>(null)
  const [status, setStatus] = useState('Ready to read')
  const [selectionEnabled, setSelectionEnabled] = useState(true)
  const [feedback, setFeedback] = useState('')

  useEffect(() => {
    void Promise.all([
      chrome.tabs.query({ active: true, currentWindow: true }),
      settingsService.get(),
      getActiveReaderState(),
    ])
      .then(([tabs, settings, response]) => {
        setPageTitle(tabs[0]?.title || 'Current page')
        setTabId(tabs[0]?.id ?? null)
        setSelectionEnabled(settings.autoShowSelectionButton)
        if (response.ok && response.data && response.data.status !== 'idle') {
          setStatus(
            response.data.status === 'playing' ? 'Reading now' : response.data.status,
          )
        }
        document.documentElement.dataset.theme = settings.theme
      })
      .catch(() => setFeedback('Unable to load TextReader settings.'))
  }, [])

  const toggleSelection = async () => {
    try {
      const settings = await settingsService.update({
        autoShowSelectionButton: !selectionEnabled,
      })
      setSelectionEnabled(settings.autoShowSelectionButton)
      setFeedback('')
    } catch {
      setFeedback('Unable to save this setting.')
    }
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
    setFeedback(response.error.message)
  }

  return (
    <main className="w-[320px] p-3.5">
      <div className="rounded-[18px] border border-[var(--tr-border)] bg-[var(--tr-surface)] p-4 shadow-sm">
        <Logo />
        <div className="my-4 rounded-xl bg-[var(--tr-soft)] p-3">
          <p className="m-0 truncate text-[12px] font-medium" title={pageTitle}>
            {pageTitle}
          </p>
          <p className="mb-0 mt-1 text-[11px] capitalize text-[var(--tr-muted)]">
            {status}
          </p>
        </div>
        <button
          type="button"
          disabled={tabId === null}
          className="h-10 w-full rounded-xl bg-[var(--tr-accent)] text-[12px] font-semibold text-[var(--tr-accent-text)] disabled:opacity-50"
          onClick={() => void openReader()}
        >
          Open Reader
        </button>
        <div className="mt-4 flex items-center justify-between border-t border-[var(--tr-border)] pt-3">
          <span className="text-[12px]">Selection reading</span>
          <button
            type="button"
            role="switch"
            aria-checked={selectionEnabled}
            aria-label="Toggle selection reading"
            className={`relative h-6 w-10 rounded-full transition ${selectionEnabled ? 'bg-[var(--tr-accent)]' : 'bg-[var(--tr-soft)]'}`}
            onClick={() => void toggleSelection()}
          >
            <span
              className={`absolute top-1 size-4 rounded-full bg-white shadow-sm transition ${selectionEnabled ? 'left-5' : 'left-1'}`}
            />
          </button>
        </div>
        {feedback && (
          <p className="mb-0 mt-3 text-[11px] text-[#b42318]" role="alert">
            {feedback}
          </p>
        )}
      </div>
    </main>
  )
}
