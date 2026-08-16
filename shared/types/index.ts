export type ReaderStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'stopped' | 'error'

export type ReaderSource = 'selection' | 'article' | 'page'

export type ThemePreference = 'system' | 'light' | 'dark'

export type HighlightMode = 'off' | 'sentence' | 'paragraph'

export interface TextSelection {
  text: string
  pageUrl: string
  pageTitle: string
  rect: {
    x: number
    y: number
    width: number
    height: number
  }
  timestamp: number
  isLargeSelection: boolean
}

export interface ReaderSettings {
  schemaVersion: 2
  voiceId: string
  speed: number
  pitch: number
  volume: number
  autoShowSelectionButton: boolean
  theme: ThemePreference
  highlightMode: HighlightMode
}

export interface ReaderSentence {
  id: string
  text: string
  index: number
  paragraphId: string
}

export interface ReaderParagraph {
  id: string
  text: string
  index: number
  sentences: ReaderSentence[]
}

export interface ReaderDocument {
  id: string
  url: string
  title: string
  byline?: string
  siteName?: string
  language?: string
  paragraphs: ReaderParagraph[]
  plainText: string
  createdAt: number
}

export interface SpeechChunk {
  id: string
  sentenceIds: string[]
  text: string
  charCount: number
}

export interface ReadingProgress {
  url: string
  documentId: string
  source: 'article' | 'page'
  sentenceIndex: number
  progress: number
  updatedAt: number
}

export interface ReaderState {
  status: ReaderStatus
  source: ReaderSource
  text: string
  currentSentenceIndex: number
  currentParagraphIndex: number
  sentenceCount: number
  progress: number
  settings: ReaderSettings
  documentId?: string
  documentTitle?: string
  siteName?: string
  resumeAvailable?: boolean
  resumeSentenceIndex?: number
  errorCode?: string
}

export interface TTSRequest {
  text: string
  voiceId?: string
  rate: number
  pitch: number
  volume: number
  language?: string
  startSentenceIndex?: number
  sentences?: string[]
}

export interface TTSController {
  speak(request: TTSRequest): Promise<void>
  pause(): void
  resume(): void
  stop(): void
}
