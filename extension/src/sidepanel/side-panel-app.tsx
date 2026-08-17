import { useEffect, useRef, useState } from 'react'
import type { ReaderDocument, ReaderSettings } from '@textreader/shared'
import { Logo } from '@/components/logo'
import { SliderField } from '@/components/slider-field'
import { shouldIgnoreReaderKeyboardTarget } from '@/content/reader-keyboard'
import {
  isReaderWindowActivation,
  useReaderConnection,
} from '@/hooks/use-reader-connection'
import type { TextReaderMessage } from '@/services/messaging/protocol'
import { sendToActiveTab } from '@/services/messaging/transport'
import { settingsService } from '@/services/settings/settings'
import { useReaderStore } from '@/stores/reader-store'
import { estimateSpeechSeconds, formatDuration } from '@/utils/time'
import { primaryReaderCommand } from './side-panel-commands'

function PlayIcon({ playing }: { playing: boolean }) {
  return playing ? (
    <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden="true">
      <path d="M7 5h4v14H7V5Zm6 0h4v14h-4V5Z" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden="true">
      <path d="M8 5v14l11-7L8 5Z" />
    </svg>
  )
}

interface DocumentViewProps {
  document: ReaderDocument
  currentSentenceIndex: number
  disabled: boolean
  onJump: (index: number) => void
}

function DocumentView({
  document,
  currentSentenceIndex,
  disabled,
  onJump,
}: DocumentViewProps) {
  const currentSentenceRef = useRef<HTMLButtonElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const target = currentSentenceRef.current
    const container = scrollContainerRef.current
    if (!target || !container) return
    const targetRect = target.getBoundingClientRect()
    const containerRect = container.getBoundingClientRect()
    if (targetRect.top >= containerRect.top && targetRect.bottom <= containerRect.bottom)
      return
    target.scrollIntoView({
      block: 'nearest',
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'auto'
        : 'smooth',
    })
  }, [currentSentenceIndex])

  return (
    <div
      ref={scrollContainerRef}
      className="min-h-0 flex-1 overflow-y-auto px-4 py-4"
      aria-label="Reader document"
    >
      <div className="mb-5">
        <h1 className="m-0 text-[19px] font-semibold leading-6 tracking-[-0.025em]">
          {document.title}
        </h1>
        {(document.siteName || document.byline) && (
          <p className="mb-0 mt-1.5 text-[11px] text-[var(--tr-muted)]">
            {[document.siteName, document.byline].filter(Boolean).join(' · ')}
          </p>
        )}
      </div>
      <article className="space-y-4 text-[14px] leading-6">
        {document.paragraphs.map((paragraph) => (
          <p key={paragraph.id} className="m-0">
            {paragraph.sentences.map((sentence) => {
              const current = sentence.index === currentSentenceIndex
              return (
                <button
                  key={sentence.id}
                  ref={current ? currentSentenceRef : undefined}
                  type="button"
                  disabled={disabled}
                  className={`inline rounded px-0.5 text-left transition-colors ${
                    current
                      ? 'bg-[var(--tr-highlight)] font-medium text-[var(--tr-text)]'
                      : 'text-[var(--tr-muted)] hover:text-[var(--tr-text)]'
                  }`}
                  aria-current={current ? 'true' : undefined}
                  aria-label={`Jump to sentence ${sentence.index + 1}`}
                  onClick={() => onJump(sentence.index)}
                >
                  {sentence.text}{' '}
                </button>
              )
            })}
          </p>
        ))}
      </article>
    </div>
  )
}

export function SidePanelApp() {
  const reader = useReaderStore((state) => state.reader)
  const readerDocument = useReaderStore((state) => state.document)
  const connectionError = useReaderConnection()
  const pageTabId = useRef<number | undefined>(undefined)
  const pageWindowId = useRef<number | undefined>(undefined)
  const [pageTitle, setPageTitle] = useState('Current page')
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [toast, setToast] = useState('')

  const speechText = readerDocument?.plainText ?? reader.text
  const totalSeconds = estimateSpeechSeconds(speechText, reader.settings.speed)
  const elapsedSeconds = Math.round(totalSeconds * reader.progress)
  const hasDocument = Boolean(readerDocument)
  const isPlaying = reader.status === 'playing'
  const isLoading = reader.status === 'loading'
  const readerError =
    reader.status === 'error' ? 'The system voice could not play this text.' : ''
  const activeToast = toast || connectionError || readerError
  const selectedVoiceAvailable =
    !reader.settings.voiceId ||
    voices.some(
      (voice) =>
        voice.voiceURI === reader.settings.voiceId ||
        voice.name === reader.settings.voiceId,
    )

  useEffect(() => {
    const updateTitle = () => {
      void chrome.tabs
        .query({ active: true, currentWindow: true })
        .then(([tab]) => {
          pageTabId.current = tab?.id
          pageWindowId.current = tab?.windowId
          setPageTitle(tab?.title || 'Current page')
        })
        .catch(() => setPageTitle('Current page'))
    }
    updateTitle()
    const handleActivated: Parameters<typeof chrome.tabs.onActivated.addListener>[0] = (
      activeInfo,
    ) => {
      if (!isReaderWindowActivation(pageWindowId.current, activeInfo.windowId)) return
      pageWindowId.current = activeInfo.windowId
      updateTitle()
    }
    chrome.tabs.onActivated.addListener(handleActivated)
    const handleUpdated: Parameters<typeof chrome.tabs.onUpdated.addListener>[0] = (
      tabId,
      changeInfo,
    ) => {
      if (tabId === pageTabId.current && changeInfo.title) setPageTitle(changeInfo.title)
    }
    chrome.tabs.onUpdated.addListener(handleUpdated)
    return () => {
      chrome.tabs.onActivated.removeListener(handleActivated)
      chrome.tabs.onUpdated.removeListener(handleUpdated)
    }
  }, [])

  useEffect(() => {
    const loadVoices = () => setVoices(window.speechSynthesis.getVoices())
    loadVoices()
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', loadVoices)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = reader.settings.theme
  }, [reader.settings.theme])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 3600)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    const handleKeyboard = (event: KeyboardEvent) => {
      if (!readerDocument || isLoading || shouldIgnoreReaderKeyboardTarget(event.target))
        return
      let message: TextReaderMessage | undefined
      if (event.code === 'Space') {
        message = primaryReaderCommand(reader, true)
      } else if (event.key === 'ArrowRight') {
        message = { type: event.shiftKey ? 'READER_NEXT_PARAGRAPH' : 'READER_NEXT' }
      } else if (event.key === 'ArrowLeft') {
        message = {
          type: event.shiftKey ? 'READER_PREVIOUS_PARAGRAPH' : 'READER_PREVIOUS',
        }
      }
      if (message) {
        event.preventDefault()
        void sendToActiveTab(message)
      }
    }
    document.addEventListener('keydown', handleKeyboard)
    return () => document.removeEventListener('keydown', handleKeyboard)
  }, [isLoading, reader, readerDocument])

  const command = async (message: TextReaderMessage) => {
    try {
      const response = await sendToActiveTab(message)
      if (!response.ok) setToast(response.error.message)
      return response
    } catch {
      setToast('Unable to contact this page.')
      return null
    }
  }

  const updateSettings = async (
    patch: Partial<Omit<ReaderSettings, 'schemaVersion'>>,
  ) => {
    try {
      await settingsService.update(patch)
    } catch {
      setToast('Unable to save this setting.')
    }
  }

  const handlePrimary = async () => {
    await command(primaryReaderCommand(reader, hasDocument))
  }

  return (
    <main className="flex h-screen min-h-[520px] flex-col p-3.5" aria-busy={isLoading}>
      <header className="mb-3 flex items-center justify-between px-1 py-1">
        <Logo />
        <span
          className="max-w-[48%] truncate text-[11px] text-[var(--tr-muted)]"
          title={pageTitle}
        >
          {pageTitle}
        </span>
      </header>

      {reader.resumeAvailable && (
        <section className="mb-3 rounded-[16px] border border-[var(--tr-border)] bg-[var(--tr-surface)] p-3.5 shadow-sm">
          <p className="m-0 text-[12px] font-semibold">
            Continue from {Math.round(reader.progress * 100)}%?
          </p>
          <p className="mb-3 mt-1 text-[11px] text-[var(--tr-muted)]">
            Your reading position was saved on this page.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={isLoading}
              className="h-9 rounded-xl bg-[var(--tr-accent)] text-[12px] font-semibold text-[var(--tr-accent-text)]"
              onClick={() => void command({ type: 'CONTINUE_READING' })}
            >
              Continue
            </button>
            <button
              type="button"
              disabled={isLoading}
              className="h-9 rounded-xl bg-[var(--tr-soft)] text-[12px] font-medium"
              onClick={() => void command({ type: 'START_OVER' })}
            >
              Start over
            </button>
          </div>
        </section>
      )}

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[20px] border border-[var(--tr-border)] bg-[var(--tr-surface)] shadow-[0_18px_45px_rgba(15,23,42,0.07)] backdrop-blur-xl">
        {readerDocument ? (
          <DocumentView
            document={readerDocument}
            currentSentenceIndex={reader.currentSentenceIndex}
            disabled={isLoading}
            onJump={(index) =>
              void command({ type: 'JUMP_TO_SENTENCE', payload: { index } })
            }
          />
        ) : (
          <div className="flex min-h-0 flex-1 flex-col justify-center px-5 py-8">
            <span className="mb-3 grid size-10 place-items-center rounded-xl bg-[var(--tr-soft)]">
              <svg
                viewBox="0 0 24 24"
                className="size-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                aria-hidden="true"
              >
                <path d="M5 4.5h9a3 3 0 0 1 3 3v12H8a3 3 0 0 0-3 3v-18Z" />
                <path d="M17 9.5 21 7v8l-4-2.5" fill="currentColor" stroke="none" />
              </svg>
            </span>
            <h1 className="m-0 text-xl font-semibold tracking-[-0.03em]">
              Listen to this page.
            </h1>
            <p className="mb-5 mt-2 text-[13px] leading-5 text-[var(--tr-muted)]">
              Extract the main article, read all page text, or select a passage on the
              webpage.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={isLoading}
                className="h-10 rounded-xl bg-[var(--tr-accent)] text-[12px] font-semibold text-[var(--tr-accent-text)]"
                onClick={() =>
                  void command({ type: 'READ_PAGE', payload: { mode: 'article' } })
                }
              >
                Read article
              </button>
              <button
                type="button"
                disabled={isLoading}
                className="h-10 rounded-xl bg-[var(--tr-soft)] text-[12px] font-medium"
                onClick={() =>
                  void command({ type: 'READ_PAGE', payload: { mode: 'page' } })
                }
              >
                Read page
              </button>
            </div>
          </div>
        )}

        <div className="border-t border-[var(--tr-border)] px-4 py-3.5">
          <div className="mb-3 flex items-center justify-center gap-3">
            <button
              type="button"
              className="grid size-9 place-items-center rounded-full bg-[var(--tr-soft)] transition hover:brightness-95 disabled:opacity-40"
              disabled={isLoading || !hasDocument || reader.currentSentenceIndex === 0}
              onClick={() => void command({ type: 'READER_PREVIOUS' })}
              aria-label="Previous sentence"
            >
              <svg
                viewBox="0 0 24 24"
                className="size-4"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="m14.8 5-7 7 7 7V5Z" />
              </svg>
            </button>
            <button
              type="button"
              className="grid size-11 place-items-center rounded-full bg-[var(--tr-accent)] text-[var(--tr-accent-text)] shadow-md transition hover:scale-[1.02] disabled:cursor-wait disabled:opacity-70"
              disabled={isLoading}
              onClick={() => void handlePrimary()}
              aria-label={isLoading ? 'Starting playback' : isPlaying ? 'Pause' : 'Play'}
            >
              <PlayIcon playing={isPlaying} />
            </button>
            <button
              type="button"
              className="grid size-9 place-items-center rounded-full bg-[var(--tr-soft)] transition hover:brightness-95 disabled:opacity-40"
              disabled={
                isLoading ||
                !hasDocument ||
                reader.currentSentenceIndex >= Math.max(0, reader.sentenceCount - 1)
              }
              onClick={() => void command({ type: 'READER_NEXT' })}
              aria-label="Next sentence"
            >
              <svg
                viewBox="0 0 24 24"
                className="size-4"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="m9.2 5 7 7-7 7V5Z" />
              </svg>
            </button>
          </div>
          <div
            className="h-1.5 overflow-hidden rounded-full bg-[var(--tr-soft)]"
            role="progressbar"
            aria-label="Reading progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(reader.progress * 100)}
            aria-valuetext={`${Math.round(reader.progress * 100)}% read`}
          >
            <div
              className="h-full rounded-full bg-[var(--tr-accent)] transition-[width] duration-150"
              style={{ width: `${reader.progress * 100}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between text-[11px] tabular-nums text-[var(--tr-muted)]">
            <span>{formatDuration(elapsedSeconds)}</span>
            <span>{formatDuration(totalSeconds)}</span>
          </div>
        </div>

        <details className="border-t border-[var(--tr-border)] px-4 py-3">
          <summary className="cursor-pointer text-[12px] font-semibold">
            Voice & reading settings
          </summary>
          <div className="mt-4 space-y-4 pb-1">
            <label className="block">
              <span className="mb-2 block text-[12px] font-medium">Voice</span>
              <select
                className="h-10 w-full rounded-xl border border-[var(--tr-border)] bg-[var(--tr-surface-strong)] px-3 text-[13px]"
                value={reader.settings.voiceId}
                onChange={(event) => void updateSettings({ voiceId: event.target.value })}
              >
                <option value="">System default</option>
                {!selectedVoiceAvailable && (
                  <option value={reader.settings.voiceId}>Unavailable saved voice</option>
                )}
                {voices.map((voice) => (
                  <option key={voice.voiceURI} value={voice.voiceURI}>
                    {voice.name} · {voice.lang}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-[12px] font-medium">Highlight</span>
              <select
                className="h-10 w-full rounded-xl border border-[var(--tr-border)] bg-[var(--tr-surface-strong)] px-3 text-[13px]"
                value={reader.settings.highlightMode}
                onChange={(event) =>
                  void updateSettings({
                    highlightMode: event.target.value as ReaderSettings['highlightMode'],
                  })
                }
              >
                <option value="off">Off</option>
                <option value="sentence">Sentence</option>
                <option value="paragraph">Paragraph</option>
              </select>
            </label>
            <SliderField
              label="Speed"
              valueLabel={`${reader.settings.speed.toFixed(2)}×`}
              value={reader.settings.speed}
              minimum={0.5}
              maximum={2.5}
              step={0.05}
              onChange={(speed) => void updateSettings({ speed })}
            />
            <SliderField
              label="Pitch"
              valueLabel={`${reader.settings.pitch > 0 ? '+' : ''}${reader.settings.pitch}`}
              value={reader.settings.pitch}
              minimum={-50}
              maximum={50}
              step={1}
              onChange={(pitch) => void updateSettings({ pitch })}
            />
            <SliderField
              label="Volume"
              valueLabel={`${Math.round(reader.settings.volume * 100)}%`}
              value={reader.settings.volume}
              minimum={0}
              maximum={1}
              step={0.01}
              onChange={(volume) => void updateSettings({ volume })}
            />
          </div>
        </details>
      </section>

      <span className="sr-only" role="status" aria-live="polite">
        Reader status: {reader.status}
      </span>

      <footer className="mt-3 grid grid-cols-[1fr_1fr_auto_auto] gap-2">
        <button
          type="button"
          disabled={isLoading}
          className="h-10 rounded-xl bg-[var(--tr-accent)] px-2 text-[11px] font-semibold text-[var(--tr-accent-text)]"
          onClick={() =>
            void command({ type: 'READ_PAGE', payload: { mode: 'article' } })
          }
        >
          Read Article
        </button>
        <button
          type="button"
          disabled={isLoading}
          className="h-10 rounded-xl border border-[var(--tr-border)] bg-[var(--tr-surface)] px-2 text-[11px] font-medium"
          onClick={() => void command({ type: 'READ_PAGE', payload: { mode: 'page' } })}
        >
          Read Page
        </button>
        <button
          type="button"
          className="h-10 rounded-xl border border-[var(--tr-border)] bg-[var(--tr-surface)] px-3 text-[11px] font-medium disabled:opacity-40"
          disabled={!hasDocument && !isLoading}
          onClick={() => void command({ type: 'READER_STOP' })}
        >
          Stop
        </button>
        <button
          type="button"
          className="grid size-10 place-items-center rounded-xl border border-[var(--tr-border)] bg-[var(--tr-surface)]"
          onClick={() => void chrome.runtime.openOptionsPage()}
          aria-label="Settings"
        >
          <svg
            viewBox="0 0 24 24"
            className="size-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            aria-hidden="true"
          >
            <path d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z" />
            <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.86 2.86-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21H9.55v-.1A1.7 1.7 0 0 0 8.45 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.86-2.86.06-.06A1.7 1.7 0 0 0 4.05 15a1.7 1.7 0 0 0-1.5-1H2.4V10h.15a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.34-1.88l-.06-.06L6.5 4.2l.06.06A1.7 1.7 0 0 0 8.45 4a1.7 1.7 0 0 0 1-1.5V2.4h4.05v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.86 2.86-.06.06A1.7 1.7 0 0 0 19 8.4a1.7 1.7 0 0 0 1.5 1h.1v4.05h-.1a1.7 1.7 0 0 0-1.1 1.55Z" />
          </svg>
        </button>
      </footer>

      {activeToast && (
        <div
          role="alert"
          className="fixed inset-x-4 bottom-16 rounded-xl bg-[#1e2530] px-3.5 py-3 text-[12px] text-white shadow-xl"
        >
          {activeToast}
        </div>
      )}
    </main>
  )
}
