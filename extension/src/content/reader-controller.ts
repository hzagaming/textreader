import type {
  ReaderDocument,
  ReaderSettings,
  ReaderSource,
  ReaderState,
  ReadingProgress,
  TextSelection,
} from '@textreader/shared'
import {
  ArticleExtractor,
  type ExtractionMode,
} from '@/services/article/article-extractor'
import {
  HighlightManager,
  type DocumentTextScope,
} from '@/services/highlight/highlight-manager'
import {
  failure,
  isTextReaderMessage,
  ok,
  type MessageResponse,
} from '@/services/messaging/protocol'
import { sendRuntimeMessage } from '@/services/messaging/transport'
import { readingProgressService } from '@/services/progress/reading-progress'
import { createReaderDocument } from '@/services/reader/document-factory'
import { LatestOperation } from '@/services/reader/latest-operation'
import { ReaderQueue } from '@/services/reader/reader-queue'
import { DEFAULT_SETTINGS, settingsService } from '@/services/settings/settings'
import {
  BrowserTTSProvider,
  type PlaybackSnapshot,
} from '@/services/tts/browser-tts-provider'
import { asTextReaderError, TextReaderError } from '@/types/errors'
import { SelectionFloatingButton } from './floating-button'
import {
  shouldHandleReaderKeyboard,
  shouldIgnoreReaderKeyboardTarget,
} from './reader-keyboard'
import { SelectionManager } from './selection-manager'

export class ContentReaderController {
  private state: ReaderState = {
    status: 'idle',
    source: 'selection',
    text: '',
    currentSentenceIndex: 0,
    currentParagraphIndex: 0,
    sentenceCount: 0,
    progress: 0,
    settings: DEFAULT_SETTINGS,
  }
  private document: ReaderDocument | undefined
  private storedProgress: ReadingProgress | undefined
  private selectionScope: DocumentTextScope | undefined
  private readonly readOperations = new LatestOperation()
  private readonly queue = new ReaderQueue()
  private readonly highlight = new HighlightManager(document)
  private readonly floatingButton = new SelectionFloatingButton(
    (selection) => void this.readSelection(selection),
    () => void this.readPage('article', false),
  )
  private readonly selectionManager = new SelectionManager((selection) => {
    this.handleSelection(selection)
  })
  private readonly tts = new BrowserTTSProvider(window.speechSynthesis, (snapshot) => {
    this.handlePlaybackChange(snapshot)
  })
  private unsubscribeSettings: (() => void) | undefined

  async start(): Promise<void> {
    const [settings, progress] = await Promise.all([
      settingsService.get().catch(() => DEFAULT_SETTINGS),
      readingProgressService.get(window.location.href).catch(() => undefined),
    ])
    this.state = { ...this.state, settings }
    this.floatingButton.setLanguage(settings.uiLanguage)
    this.storedProgress = progress
    if (progress && progress.progress > 0.01 && progress.progress < 0.98) {
      this.state = {
        ...this.state,
        source: progress.source,
        documentId: progress.documentId,
        progress: progress.progress,
        resumeAvailable: true,
        resumeSentenceIndex: progress.sentenceIndex,
      }
    }

    this.selectionManager.start()
    this.unsubscribeSettings = settingsService.subscribe((nextSettings) => {
      this.applySettings(nextSettings)
    })
    chrome.runtime.onMessage.addListener(this.handleMessage)
    document.addEventListener('keydown', this.handleReaderKeyboard, true)
    this.broadcastState()
  }

  stop(): void {
    this.readOperations.cancel()
    this.selectionManager.stop()
    this.floatingButton.destroy()
    this.highlight.destroy()
    this.tts.stop()
    this.unsubscribeSettings?.()
    chrome.runtime.onMessage.removeListener(this.handleMessage)
    document.removeEventListener('keydown', this.handleReaderKeyboard, true)
  }

  private handleSelection(selection: TextSelection | null): void {
    if (!selection) {
      this.floatingButton.hide()
      return
    }

    if (this.state.settings.autoShowSelectionButton) this.floatingButton.show(selection)
  }

  private async readSelection(selection: TextSelection): Promise<MessageResponse> {
    const currentSelection = this.selectionManager.getCurrent()
    const range =
      currentSelection?.timestamp === selection.timestamp
        ? (this.selectionManager.getCurrentRange() ?? undefined)
        : undefined
    return this.readText(selection.text, range)
  }

  private async readText(text: string, selectionRange?: Range): Promise<MessageResponse> {
    this.readOperations.begin()
    const normalized = text.replace(/\s+/gu, ' ').trim()
    if (!normalized) return failure('EMPTY_TEXT', 'There is no text to read.')

    const readerDocument = createReaderDocument({
      url: window.location.href,
      title: document.title || 'Selected text',
      paragraphs: [normalized],
      language: document.documentElement.lang,
    })
    return this.readDocument(readerDocument, 'selection', 0, selectionRange)
  }

  private async readPage(
    mode: ExtractionMode,
    offerResume = true,
  ): Promise<MessageResponse> {
    const operation = this.readOperations.begin()
    this.tts.stop(false)
    this.updateStatus('loading')
    this.highlight.clear()

    try {
      const readerDocument = new ArticleExtractor(document, window.location.href).extract(
        mode,
      )
      const progress =
        this.storedProgress ?? (await readingProgressService.get(window.location.href))
      if (!this.readOperations.isCurrent(operation)) return ok()
      if (
        offerResume &&
        progress &&
        progress.source === mode &&
        progress.documentId === readerDocument.id &&
        progress.progress > 0.01 &&
        progress.progress < 0.98
      ) {
        this.prepareResume(readerDocument, mode, progress)
        return ok()
      }
      return this.readDocument(readerDocument, mode, 0)
    } catch (error) {
      if (!this.readOperations.isCurrent(operation)) return ok()
      return this.handleError(error)
    }
  }

  private async continueReading(): Promise<MessageResponse> {
    const operation = this.readOperations.begin()
    this.tts.stop(false)
    this.updateStatus('loading')

    try {
      const progress =
        this.storedProgress ?? (await readingProgressService.get(window.location.href))
      if (!this.readOperations.isCurrent(operation)) return ok()
      const mode = progress?.source ?? (this.state.source === 'page' ? 'page' : 'article')
      const readerDocument = new ArticleExtractor(document, window.location.href).extract(
        mode,
      )
      const startIndex =
        progress?.documentId === readerDocument.id ? progress.sentenceIndex : 0
      return this.readDocument(readerDocument, mode, startIndex)
    } catch (error) {
      if (!this.readOperations.isCurrent(operation)) return ok()
      return this.handleError(error)
    }
  }

  private async startOver(): Promise<MessageResponse> {
    const operation = this.readOperations.begin()
    const mode =
      this.storedProgress?.source ?? (this.state.source === 'page' ? 'page' : 'article')
    this.tts.stop(false)
    this.updateStatus('loading')
    try {
      await readingProgressService.clear(window.location.href)
      if (!this.readOperations.isCurrent(operation)) return ok()
      this.storedProgress = undefined
      return this.readPage(mode, false)
    } catch (error) {
      if (!this.readOperations.isCurrent(operation)) return ok()
      return this.handleError(error)
    }
  }

  private async readDocument(
    readerDocument: ReaderDocument,
    source: ReaderSource,
    startSentenceIndex: number,
    selectionRange?: Range,
  ): Promise<MessageResponse> {
    const firstSentence = this.queue.loadDocument(readerDocument, startSentenceIndex)
    if (!firstSentence)
      return failure('EMPTY_TEXT', 'There is no readable text on this page.')

    this.document = readerDocument
    this.highlight.rebuild()
    this.selectionScope =
      source === 'selection' && selectionRange
        ? this.highlight.createScope(selectionRange)
        : undefined
    this.broadcastDocument()
    this.state = {
      status: 'loading',
      source,
      text: firstSentence.text,
      currentSentenceIndex: firstSentence.index,
      currentParagraphIndex: this.queue.currentParagraphIndex(),
      sentenceCount: this.queue.getSentences().length,
      progress: firstSentence.index / Math.max(1, this.queue.getSentences().length),
      settings: this.state.settings,
      documentId: readerDocument.id,
      documentTitle: readerDocument.title,
      ...(readerDocument.siteName ? { siteName: readerDocument.siteName } : {}),
    }
    this.broadcastState()

    try {
      const {
        voiceId,
        voiceByLanguage,
        readingLanguage,
        speed,
        pitch,
        volume,
        naturalExpression,
      } = this.state.settings
      await this.tts.speak({
        text: readerDocument.plainText,
        sentences: this.queue.getSentences().map((sentence) => sentence.text),
        rate: speed,
        pitch,
        volume,
        naturalExpression,
        readingLanguage,
        voiceByLanguage,
        startSentenceIndex: firstSentence.index,
        ...(readerDocument.language ? { language: readerDocument.language } : {}),
        ...(voiceId ? { voiceId } : {}),
      })
      return ok()
    } catch (error) {
      return this.handleError(error)
    }
  }

  private prepareResume(
    readerDocument: ReaderDocument,
    source: 'article' | 'page',
    progress: ReadingProgress,
  ): void {
    const sentence = this.queue.loadDocument(readerDocument, progress.sentenceIndex)
    this.document = readerDocument
    this.highlight.rebuild()
    this.broadcastDocument()
    this.state = {
      status: 'stopped',
      source,
      text: sentence?.text ?? '',
      currentSentenceIndex: sentence?.index ?? 0,
      currentParagraphIndex: this.queue.currentParagraphIndex(),
      sentenceCount: this.queue.getSentences().length,
      progress: progress.progress,
      settings: this.state.settings,
      documentId: readerDocument.id,
      documentTitle: readerDocument.title,
      resumeAvailable: true,
      resumeSentenceIndex: progress.sentenceIndex,
      ...(readerDocument.siteName ? { siteName: readerDocument.siteName } : {}),
    }
    this.broadcastState()
  }

  private applySettings(settings: ReaderSettings): void {
    this.state = { ...this.state, settings }
    this.floatingButton.setLanguage(settings.uiLanguage)
    this.tts.updateRequest({
      voiceId: settings.voiceId,
      voiceByLanguage: settings.voiceByLanguage,
      readingLanguage: settings.readingLanguage,
      rate: settings.speed,
      pitch: settings.pitch,
      volume: settings.volume,
      naturalExpression: settings.naturalExpression,
    })
    if (!settings.autoShowSelectionButton) this.floatingButton.hide()
    this.applyHighlight()
    this.broadcastState()
  }

  private handlePlaybackChange(snapshot: PlaybackSnapshot): void {
    const sentence = this.queue.jumpToSentence(snapshot.sentenceIndex)
    const progress =
      snapshot.status === 'finished'
        ? 1
        : snapshot.sentenceCount > 0
          ? snapshot.sentenceIndex / snapshot.sentenceCount
          : 0

    if (snapshot.status === 'error') {
      this.state = {
        ...this.state,
        status: 'error',
        text: sentence?.text ?? this.state.text,
        currentSentenceIndex: snapshot.sentenceIndex,
        currentParagraphIndex: this.queue.currentParagraphIndex(),
        sentenceCount: snapshot.sentenceCount,
        progress,
        errorCode: snapshot.error?.code ?? 'TTS_ERROR',
      }
      this.highlight.clear()
      this.broadcastState()
      return
    }

    const status = snapshot.status === 'finished' ? 'stopped' : snapshot.status
    this.state = {
      ...this.state,
      status,
      text: sentence?.text ?? this.state.text,
      currentSentenceIndex: snapshot.sentenceIndex,
      currentParagraphIndex: this.queue.currentParagraphIndex(),
      sentenceCount: snapshot.sentenceCount,
      progress,
    }
    delete this.state.errorCode
    delete this.state.resumeAvailable
    delete this.state.resumeSentenceIndex
    if (status === 'playing' || status === 'paused') this.applyHighlight()
    else this.highlight.clear()
    this.persistProgress()
    this.broadcastState()
  }

  private applyHighlight(): void {
    if (this.state.status !== 'playing' && this.state.status !== 'paused') {
      this.highlight.clear()
      return
    }
    const mode = this.state.settings.highlightMode
    if (mode === 'off') {
      this.highlight.clear()
      return
    }
    const text =
      mode === 'paragraph'
        ? this.queue.currentParagraph()?.text
        : this.queue.current()?.text
    if (!text) return
    this.highlight.show(
      text,
      mode,
      this.queue.currentTextOccurrence(mode),
      this.state.source === 'selection' ? this.selectionScope : undefined,
    )
  }

  private persistProgress(): void {
    if (
      !this.document ||
      (this.state.source !== 'article' && this.state.source !== 'page')
    ) {
      return
    }
    const progress: ReadingProgress = {
      url: window.location.href,
      documentId: this.document.id,
      source: this.state.source,
      sentenceIndex: this.state.currentSentenceIndex,
      progress: this.state.progress,
      updatedAt: Date.now(),
    }
    this.storedProgress = progress
    void readingProgressService.save(progress).catch(() => undefined)
  }

  private jumpToSentence(index: number): MessageResponse {
    const sentence = this.queue.jumpToSentence(index)
    if (!sentence) return failure('EMPTY_TEXT', 'Load text before navigating.')
    this.tts.jumpToSentence(sentence.index)
    return ok()
  }

  private jumpToParagraph(index: number): MessageResponse {
    const sentence = this.queue.jumpToParagraph(index)
    if (!sentence) return failure('EMPTY_TEXT', 'Load text before navigating.')
    this.tts.jumpToSentence(sentence.index)
    return ok()
  }

  private readonly handleReaderKeyboard = (event: KeyboardEvent) => {
    if (
      !shouldHandleReaderKeyboard(this.state.status, Boolean(this.document)) ||
      shouldIgnoreReaderKeyboardTarget(event.target)
    ) {
      return
    }

    if (event.code === 'Space') {
      event.preventDefault()
      if (this.state.status === 'playing') this.tts.pause()
      else if (this.state.status === 'paused') this.tts.resume()
      return
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault()
      if (event.shiftKey) this.jumpToParagraph(this.queue.currentParagraphIndex() + 1)
      else this.jumpToSentence(this.queue.getSentenceIndex() + 1)
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      if (event.shiftKey) this.jumpToParagraph(this.queue.currentParagraphIndex() - 1)
      else this.jumpToSentence(this.queue.getSentenceIndex() - 1)
    }
  }

  private readonly handleMessage: Parameters<
    typeof chrome.runtime.onMessage.addListener
  >[0] = (message: unknown, _sender, sendResponse) => {
    if (!isTextReaderMessage(message)) return false

    const respond = async (): Promise<MessageResponse<unknown>> => {
      switch (message.type) {
        case 'READ_TEXT':
          return this.readMatchingSelection(message.payload.text)
        case 'READ_CURRENT_SELECTION': {
          const selection = this.selectionManager.getCurrent()
          if (!selection) return failure('NO_SELECTION', 'Select some text first.')
          return this.readSelection(selection)
        }
        case 'READ_PAGE':
          return this.readPage(message.payload.mode)
        case 'CONTINUE_READING':
          return this.continueReading()
        case 'START_OVER':
          return this.startOver()
        case 'READER_PAUSE':
          this.tts.pause()
          return ok()
        case 'READER_RESUME':
          this.tts.resume()
          return ok()
        case 'READER_STOP':
          this.readOperations.cancel()
          this.tts.stop()
          return ok()
        case 'READER_NEXT':
          return this.jumpToSentence(this.queue.getSentenceIndex() + 1)
        case 'READER_PREVIOUS':
          return this.jumpToSentence(this.queue.getSentenceIndex() - 1)
        case 'READER_NEXT_PARAGRAPH':
          return this.jumpToParagraph(this.queue.currentParagraphIndex() + 1)
        case 'READER_PREVIOUS_PARAGRAPH':
          return this.jumpToParagraph(this.queue.currentParagraphIndex() - 1)
        case 'JUMP_TO_SENTENCE':
          return this.jumpToSentence(message.payload.index)
        case 'JUMP_TO_PARAGRAPH':
          return this.jumpToParagraph(message.payload.index)
        case 'GET_READER_STATE':
          return ok(this.state)
        case 'GET_READER_DOCUMENT':
          return this.document
            ? ok(this.document)
            : failure('EMPTY_TEXT', 'No reader document is loaded.')
        default:
          return failure('UNKNOWN', 'This message is not handled in the page context.')
      }
    }

    void respond()
      .then(sendResponse)
      .catch((error: unknown) => {
        const readerError =
          error instanceof TextReaderError ? error : asTextReaderError(error)
        sendResponse(failure(readerError.code, readerError.message))
      })
    return true
  }

  private updateStatus(status: ReaderState['status']): void {
    this.state = { ...this.state, status }
    delete this.state.errorCode
    if (status === 'loading') {
      delete this.state.resumeAvailable
      delete this.state.resumeSentenceIndex
    }
    this.broadcastState()
  }

  private readMatchingSelection(text: string): Promise<MessageResponse> {
    const selection = this.selectionManager.getCurrent()
    const normalized = text.replace(/\s+/gu, ' ').trim()
    return selection?.text === normalized
      ? this.readSelection(selection)
      : this.readText(normalized)
  }

  private handleError(error: unknown): MessageResponse {
    const readerError = asTextReaderError(error)
    this.state = { ...this.state, status: 'error', errorCode: readerError.code }
    this.highlight.clear()
    this.broadcastState()
    return failure(readerError.code, readerError.message)
  }

  private broadcastState(): void {
    void sendRuntimeMessage({ type: 'READER_STATE_CHANGED', payload: this.state })
  }

  private broadcastDocument(): void {
    if (this.document) {
      void sendRuntimeMessage({
        type: 'READER_DOCUMENT_CHANGED',
        payload: this.document,
      })
    }
  }
}
