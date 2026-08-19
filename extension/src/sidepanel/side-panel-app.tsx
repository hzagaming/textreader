import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  ReaderDocument,
  ReaderSettings,
  ReaderStatus,
  SupportedLanguage,
} from '@textreader/shared'
import { Logo } from '@/components/logo'
import { SliderField } from '@/components/slider-field'
import { VoiceLibrary } from '@/components/voice-library'
import { shouldIgnoreReaderKeyboardTarget } from '@/content/reader-keyboard'
import {
  isReaderWindowActivation,
  useReaderConnection,
} from '@/hooks/use-reader-connection'
import {
  isTextReaderMessage,
  type TextReaderMessage,
} from '@/services/messaging/protocol'
import { sendToActiveTab } from '@/services/messaging/transport'
import {
  createTranslator,
  resolveUiLanguage,
  translateErrorCode,
  type MessageKey,
  type Translator,
} from '@/services/i18n/i18n'
import { settingsService } from '@/services/settings/settings'
import { naturalProsody } from '@/services/tts/natural-prosody'
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
  translator: Translator
  onJump: (index: number) => void
}

function DocumentView({
  document,
  currentSentenceIndex,
  disabled,
  translator: t,
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
      aria-label={t('readerDocument')}
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
                  aria-label={t('jumpToSentence', [String(sentence.index + 1)])}
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
  const t = useMemo(
    () => createTranslator(reader.settings.uiLanguage),
    [reader.settings.uiLanguage],
  )
  const connectionError = useReaderConnection(t)
  const pageTabId = useRef<number | undefined>(undefined)
  const pageWindowId = useRef<number | undefined>(undefined)
  const previewUtterance = useRef<SpeechSynthesisUtterance | undefined>(undefined)
  const previewTimer = useRef<number | undefined>(undefined)
  const previewGeneration = useRef(0)
  const [pageTitle, setPageTitle] = useState(() => t('currentPage'))
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [toast, setToast] = useState('')
  const [previewPlaying, setPreviewPlaying] = useState(false)
  const [voiceSettingsOpen, setVoiceSettingsOpen] = useState(false)

  const speechText = readerDocument?.plainText ?? reader.text
  const totalSeconds = estimateSpeechSeconds(speechText, reader.settings.speed)
  const elapsedSeconds = Math.round(totalSeconds * reader.progress)
  const hasDocument = Boolean(readerDocument)
  const isPlaying = reader.status === 'playing'
  const isLoading = reader.status === 'loading'
  const showFooterReaderActions = hasDocument || isLoading
  const readerError =
    reader.status === 'error' ? translateErrorCode(reader.errorCode, t) : ''
  const activeToast = toast || connectionError || readerError
  const statusMessage = t(
    (
      {
        idle: 'statusIdle',
        loading: 'statusLoading',
        playing: 'statusPlaying',
        paused: 'statusPaused',
        stopped: 'statusStopped',
        error: 'statusError',
      } satisfies Record<ReaderStatus, MessageKey>
    )[reader.status],
  )

  const clearPreview = useCallback((cancel: boolean) => {
    previewGeneration.current += 1
    const shouldCancel = cancel && Boolean(previewUtterance.current)
    previewUtterance.current = undefined
    if (previewTimer.current !== undefined) {
      window.clearTimeout(previewTimer.current)
      previewTimer.current = undefined
    }
    if (shouldCancel) window.speechSynthesis.cancel()
    setPreviewPlaying(false)
  }, [])

  const stopPreview = useCallback(() => clearPreview(true), [clearPreview])

  useEffect(() => {
    const updateTitle = () => {
      void chrome.tabs
        .query({ active: true, currentWindow: true })
        .then(([tab]) => {
          pageTabId.current = tab?.id
          pageWindowId.current = tab?.windowId
          setPageTitle(tab?.title || t('currentPage'))
        })
        .catch(() => setPageTitle(t('currentPage')))
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
  }, [t])

  useEffect(() => {
    const loadVoices = () => setVoices(window.speechSynthesis.getVoices())
    loadVoices()
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', loadVoices)
  }, [])

  useEffect(
    () => () => {
      previewGeneration.current += 1
      const shouldCancel = Boolean(previewUtterance.current)
      previewUtterance.current = undefined
      if (previewTimer.current !== undefined) {
        window.clearTimeout(previewTimer.current)
        previewTimer.current = undefined
      }
      if (shouldCancel) window.speechSynthesis.cancel()
    },
    [],
  )

  useEffect(() => {
    const handleMessage: Parameters<typeof chrome.runtime.onMessage.addListener>[0] = (
      message,
    ) => {
      if (!isTextReaderMessage(message) || message.type !== 'VOICE_PREVIEW_STOP')
        return false
      stopPreview()
      return false
    }
    chrome.runtime.onMessage.addListener(handleMessage)
    return () => chrome.runtime.onMessage.removeListener(handleMessage)
  }, [stopPreview])

  useEffect(() => {
    document.documentElement.dataset.theme = reader.settings.theme
    document.documentElement.lang = resolveUiLanguage(reader.settings.uiLanguage)
  }, [reader.settings.theme, reader.settings.uiLanguage])

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
        stopPreview()
        void sendToActiveTab(message)
      }
    }
    document.addEventListener('keydown', handleKeyboard)
    return () => document.removeEventListener('keydown', handleKeyboard)
  }, [isLoading, reader, readerDocument, stopPreview])

  const command = async (message: TextReaderMessage) => {
    stopPreview()
    try {
      const response = await sendToActiveTab(message)
      setToast(response.ok ? '' : translateErrorCode(response.error.code, t))
      return response
    } catch {
      setToast(t('unableToContactPage'))
      return null
    }
  }

  const updateSettings = async (
    patch: Partial<Omit<ReaderSettings, 'schemaVersion'>>,
  ) => {
    stopPreview()
    try {
      await settingsService.update(patch)
      setToast('')
      return true
    } catch {
      setToast(t('unableToSaveSetting'))
      return false
    }
  }

  const previewVoice = async (
    voice: SpeechSynthesisVoice,
    language: SupportedLanguage,
  ) => {
    stopPreview()
    const generation = previewGeneration.current
    setPreviewPlaying(true)
    try {
      await sendToActiveTab({ type: 'READER_STOP' })
    } catch {
      // Preview remains available on pages that cannot run the content script.
    }
    if (generation !== previewGeneration.current) return
    setToast('')
    const samples: Record<SupportedLanguage, string> = {
      en: 'Hi, this is TextReader. Ready to listen to this page together?',
      zh: '你好，我是 TextReader。准备好一起聆听这个页面了吗？',
      ja: 'こんにちは、TextReaderです。このページを一緒に聴いてみませんか？',
      ko: '안녕하세요, TextReader입니다. 이 페이지를 함께 들어 볼까요?',
    }
    const utterance = new SpeechSynthesisUtterance(samples[language])
    utterance.voice = voice
    utterance.lang = voice.lang || language
    const prosody = naturalProsody(
      samples[language],
      {
        rate: reader.settings.speed,
        pitch: 1 + reader.settings.pitch / 50,
        volume: reader.settings.volume,
      },
      reader.settings.naturalExpression,
    )
    utterance.rate = prosody.rate
    utterance.pitch = prosody.pitch
    utterance.volume = prosody.volume
    utterance.onend = () => {
      if (previewUtterance.current === utterance) clearPreview(false)
    }
    utterance.onerror = (event) => {
      if (previewUtterance.current !== utterance) return
      clearPreview(false)
      if (event.error !== 'canceled' && event.error !== 'interrupted')
        setToast(t('ttsError'))
    }
    utterance.onstart = () => {
      if (previewUtterance.current !== utterance || previewTimer.current === undefined)
        return
      window.clearTimeout(previewTimer.current)
      previewTimer.current = undefined
    }
    previewUtterance.current = utterance
    previewTimer.current = window.setTimeout(() => {
      if (previewUtterance.current !== utterance) return
      stopPreview()
      setToast(t('ttsError'))
    }, 10_000)
    try {
      window.speechSynthesis.speak(utterance)
    } catch {
      stopPreview()
      setToast(t('ttsError'))
    }
  }

  const handlePrimary = async () => {
    await command(primaryReaderCommand(reader, hasDocument))
  }

  const openSettings = async () => {
    try {
      await chrome.runtime.openOptionsPage()
      setToast('')
    } catch {
      setToast(t('unableToContactPage'))
    }
  }

  return (
    <main className="flex h-screen min-h-0 flex-col p-3.5" aria-busy={isLoading}>
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
            {t('continueAt', [String(Math.round(reader.progress * 100))])}
          </p>
          <p className="mb-3 mt-1 text-[11px] text-[var(--tr-muted)]">
            {t('savedPosition')}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={isLoading}
              className="h-9 rounded-xl bg-[var(--tr-accent)] text-[12px] font-semibold text-[var(--tr-accent-text)]"
              onClick={() => void command({ type: 'CONTINUE_READING' })}
            >
              {t('continueReading')}
            </button>
            <button
              type="button"
              disabled={isLoading}
              className="h-9 rounded-xl bg-[var(--tr-soft)] text-[12px] font-medium"
              onClick={() => void command({ type: 'START_OVER' })}
            >
              {t('startOver')}
            </button>
          </div>
        </section>
      )}

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[20px] border border-[var(--tr-border)] bg-[var(--tr-surface)] shadow-[0_18px_45px_rgba(15,23,42,0.07)] backdrop-blur-xl">
        <div
          data-reader-content
          className={`${voiceSettingsOpen ? 'hidden' : 'flex'} min-h-0 flex-1 flex-col`}
        >
          {readerDocument ? (
            <DocumentView
              document={readerDocument}
              currentSentenceIndex={reader.currentSentenceIndex}
              disabled={isLoading}
              translator={t}
              onJump={(index) =>
                void command({ type: 'JUMP_TO_SENTENCE', payload: { index } })
              }
            />
          ) : (
            <div
              data-reader-empty
              className="tr-reader-empty flex min-h-0 flex-1 overflow-y-auto px-5 py-8"
            >
              <div className="my-auto w-full shrink-0">
                <span className="tr-reader-empty-icon mb-3 grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--tr-soft)]">
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
                  {t('listenTitle')}
                </h1>
                <p className="tr-reader-empty-description mb-5 mt-2 text-[13px] leading-5 text-[var(--tr-muted)]">
                  {t('listenDescription')}
                </p>
                <div className="grid shrink-0 grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={isLoading}
                    className="h-10 rounded-xl bg-[var(--tr-accent)] text-[12px] font-semibold text-[var(--tr-accent-text)]"
                    onClick={() =>
                      void command({ type: 'READ_PAGE', payload: { mode: 'article' } })
                    }
                  >
                    {t('readArticle')}
                  </button>
                  <button
                    type="button"
                    disabled={isLoading}
                    className="h-10 rounded-xl bg-[var(--tr-soft)] text-[12px] font-medium"
                    onClick={() =>
                      void command({ type: 'READ_PAGE', payload: { mode: 'page' } })
                    }
                  >
                    {t('readPage')}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div
          data-reader-controls
          className={`${voiceSettingsOpen || !hasDocument ? 'hidden' : 'block'} border-t border-[var(--tr-border)] px-4 py-3.5`}
        >
          <div className="mb-3 flex items-center justify-center gap-3">
            <button
              type="button"
              className="grid size-9 place-items-center rounded-full bg-[var(--tr-soft)] transition hover:brightness-95 disabled:opacity-40"
              disabled={isLoading || !hasDocument || reader.currentSentenceIndex === 0}
              onClick={() => void command({ type: 'READER_PREVIOUS' })}
              aria-label={t('previousSentence')}
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
              aria-label={
                isLoading ? t('startingPlayback') : isPlaying ? t('pause') : t('play')
              }
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
              aria-label={t('nextSentence')}
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
            aria-label={t('readingProgress')}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(reader.progress * 100)}
            aria-valuetext={t('percentRead', [String(Math.round(reader.progress * 100))])}
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

        <section
          className={`border-t border-[var(--tr-border)] px-4 py-3 ${voiceSettingsOpen ? 'flex min-h-0 flex-1 flex-col' : 'shrink-0'}`}
        >
          <button
            type="button"
            className="flex w-full shrink-0 items-center gap-1.5 text-left text-[12px] font-semibold"
            aria-expanded={voiceSettingsOpen}
            aria-label={t('voiceSettings')}
            onClick={() => setVoiceSettingsOpen((open) => !open)}
          >
            <span
              className={`text-[10px] transition-transform ${voiceSettingsOpen ? 'rotate-90' : ''}`}
              aria-hidden="true"
            >
              ▶
            </span>
            {t('voiceSettings')}
          </button>
          {voiceSettingsOpen && (
            <div className="mt-4 min-h-0 flex-1 space-y-4 overflow-y-auto pb-1 pr-1">
              <VoiceLibrary
                settings={reader.settings}
                voices={voices}
                translator={t}
                previewDisabled={isLoading}
                previewPlaying={previewPlaying}
                onUpdate={updateSettings}
                onPreview={(voice, language) => void previewVoice(voice, language)}
                onStopPreview={stopPreview}
              />
              <label className="block">
                <span className="mb-2 block text-[12px] font-medium">
                  {t('highlight')}
                </span>
                <select
                  className="h-10 w-full rounded-xl border border-[var(--tr-border)] bg-[var(--tr-surface-strong)] px-3 text-[13px]"
                  value={reader.settings.highlightMode}
                  onChange={(event) =>
                    void updateSettings({
                      highlightMode: event.target
                        .value as ReaderSettings['highlightMode'],
                    })
                  }
                >
                  <option value="off">{t('off')}</option>
                  <option value="sentence">{t('sentence')}</option>
                  <option value="paragraph">{t('paragraph')}</option>
                </select>
              </label>
              <SliderField
                label={t('speed')}
                valueLabel={`${reader.settings.speed.toFixed(2)}×`}
                value={reader.settings.speed}
                minimum={0.5}
                maximum={2.5}
                step={0.05}
                onChange={(speed) => void updateSettings({ speed })}
              />
              <SliderField
                label={t('pitch')}
                valueLabel={`${reader.settings.pitch > 0 ? '+' : ''}${reader.settings.pitch}`}
                value={reader.settings.pitch}
                minimum={-50}
                maximum={50}
                step={1}
                onChange={(pitch) => void updateSettings({ pitch })}
              />
              <SliderField
                label={t('volume')}
                valueLabel={`${Math.round(reader.settings.volume * 100)}%`}
                value={reader.settings.volume}
                minimum={0}
                maximum={1}
                step={0.01}
                onChange={(volume) => void updateSettings({ volume })}
              />
            </div>
          )}
        </section>
      </section>

      <span className="sr-only" role="status" aria-live="polite">
        {statusMessage}
      </span>

      {activeToast && (
        <div
          role="alert"
          className="mt-2 rounded-xl bg-[#1e2530] px-3.5 py-2.5 text-[12px] text-white shadow-lg"
        >
          {activeToast}
        </div>
      )}

      <footer
        className={`mt-3 gap-2 ${showFooterReaderActions ? 'grid grid-cols-[1fr_1fr_auto_auto]' : 'flex justify-end'}`}
      >
        {showFooterReaderActions && (
          <>
            <button
              type="button"
              disabled={isLoading}
              className="h-10 rounded-xl bg-[var(--tr-accent)] px-2 text-[11px] font-semibold text-[var(--tr-accent-text)]"
              onClick={() =>
                void command({ type: 'READ_PAGE', payload: { mode: 'article' } })
              }
            >
              {t('readArticle')}
            </button>
            <button
              type="button"
              disabled={isLoading}
              className="h-10 rounded-xl border border-[var(--tr-border)] bg-[var(--tr-surface)] px-2 text-[11px] font-medium"
              onClick={() =>
                void command({ type: 'READ_PAGE', payload: { mode: 'page' } })
              }
            >
              {t('readPage')}
            </button>
            <button
              type="button"
              className="h-10 rounded-xl border border-[var(--tr-border)] bg-[var(--tr-surface)] px-3 text-[11px] font-medium disabled:opacity-40"
              disabled={!hasDocument && !isLoading}
              onClick={() => void command({ type: 'READER_STOP' })}
            >
              {t('stop')}
            </button>
          </>
        )}
        <button
          type="button"
          className="grid size-10 place-items-center rounded-xl border border-[var(--tr-border)] bg-[var(--tr-surface)]"
          onClick={() => void openSettings()}
          aria-label={t('settings')}
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
    </main>
  )
}
