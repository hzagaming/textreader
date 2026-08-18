import type { TTSController, TTSRequest } from '@textreader/shared'
import {
  normalizeSupportedLanguage,
  resolveReadingLanguage,
} from '@/services/language/language'
import { TextReaderError } from '@/types/errors'
import { segmentText } from './segment-text'
import { selectVoiceForLanguage } from './voice-catalog'

const START_TIMEOUT_MS = 10_000

export type PlaybackStatus = 'playing' | 'paused' | 'stopped' | 'finished' | 'error'

export interface PlaybackSnapshot {
  status: PlaybackStatus
  sentenceIndex: number
  sentenceCount: number
  error?: TextReaderError
}

export class BrowserTTSProvider implements TTSController {
  private sentences: string[] = []
  private sentenceIndex = 0
  private request: TTSRequest | null = null
  private generation = 0
  private startTimer: ReturnType<typeof setTimeout> | undefined

  constructor(
    private readonly synthesis: SpeechSynthesis,
    private readonly onChange: (snapshot: PlaybackSnapshot) => void,
  ) {}

  speak(request: TTSRequest): Promise<void> {
    const sentences = (request.sentences ?? segmentText(request.text))
      .map((sentence) => sentence.trim())
      .filter(Boolean)
    if (sentences.length === 0)
      throw new TextReaderError('EMPTY_TEXT', 'There is no text to read.')

    this.stop(false)
    this.request = request
    this.sentences = sentences
    const startSentenceIndex = Number.isFinite(request.startSentenceIndex)
      ? Math.trunc(request.startSentenceIndex ?? 0)
      : 0
    this.sentenceIndex = Math.min(Math.max(0, startSentenceIndex), sentences.length - 1)
    this.generation += 1
    this.speakCurrent(this.generation)
    return Promise.resolve()
  }

  pause(): void {
    if (!this.synthesis.speaking || this.synthesis.paused) return
    this.synthesis.pause()
    this.emit('paused')
  }

  resume(): void {
    if (!this.synthesis.paused) return
    this.synthesis.resume()
    this.emit('playing')
  }

  stop(emit = true): void {
    this.generation += 1
    this.clearStartTimer()
    this.synthesis.cancel()
    if (emit) this.emit('stopped')
  }

  next(): void {
    if (this.sentences.length === 0) return
    this.sentenceIndex = Math.min(this.sentenceIndex + 1, this.sentences.length - 1)
    this.restartCurrent()
  }

  previous(): void {
    if (this.sentences.length === 0) return
    this.sentenceIndex = Math.max(this.sentenceIndex - 1, 0)
    this.restartCurrent()
  }

  jumpToSentence(index: number): void {
    if (this.sentences.length === 0) return
    this.sentenceIndex = Math.min(
      this.sentences.length - 1,
      Math.max(0, Math.trunc(index)),
    )
    this.restartCurrent()
  }

  updateRequest(
    settings: Pick<
      TTSRequest,
      'voiceId' | 'voiceByLanguage' | 'readingLanguage' | 'rate' | 'pitch' | 'volume'
    >,
  ): void {
    if (!this.request) return
    this.request = { ...this.request, ...settings }
  }

  private restartCurrent(): void {
    this.generation += 1
    this.clearStartTimer()
    this.synthesis.cancel()
    this.speakCurrent(this.generation)
  }

  private speakCurrent(generation: number): void {
    const text = this.sentences[this.sentenceIndex]
    const request = this.request
    if (!text || !request) return

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = request.rate
    utterance.pitch = 1 + request.pitch / 50
    utterance.volume = request.volume
    const readingLanguage = request.readingLanguage ?? 'auto'
    const language = resolveReadingLanguage(text, readingLanguage, request.language)
    const voices = this.synthesis.getVoices()
    const fixedVoice =
      readingLanguage !== 'auto' && request.voiceId
        ? voices.find(
            (voice) =>
              voice.voiceURI === request.voiceId || voice.name === request.voiceId,
          )
        : undefined
    const voice =
      fixedVoice ??
      selectVoiceForLanguage(
        voices,
        request.voiceByLanguage?.[language] || request.voiceId,
        language,
      )
    if (voice) utterance.voice = voice
    utterance.lang =
      voice && normalizeSupportedLanguage(voice.lang) === language ? voice.lang : language

    utterance.onstart = () => {
      if (generation !== this.generation) return
      this.clearStartTimer()
      this.emit('playing')
    }
    utterance.onend = () => {
      if (generation !== this.generation) return
      this.clearStartTimer()
      if (this.sentenceIndex < this.sentences.length - 1) {
        this.sentenceIndex += 1
        this.speakCurrent(generation)
      } else {
        this.emit('finished')
      }
    }
    utterance.onerror = (event) => {
      if (
        generation !== this.generation ||
        event.error === 'canceled' ||
        event.error === 'interrupted'
      ) {
        return
      }
      this.clearStartTimer()
      this.generation += 1
      this.emit(
        'error',
        new TextReaderError('TTS_ERROR', `System voice failed: ${event.error}`),
      )
    }

    this.clearStartTimer()
    this.startTimer = setTimeout(() => {
      if (generation !== this.generation) return
      this.startTimer = undefined
      this.generation += 1
      this.synthesis.cancel()
      this.emit(
        'error',
        new TextReaderError('TTS_ERROR', 'The system voice did not start.'),
      )
    }, START_TIMEOUT_MS)
    try {
      this.synthesis.speak(utterance)
    } catch {
      this.clearStartTimer()
      this.generation += 1
      this.emit('error', new TextReaderError('TTS_ERROR', 'System voice failed.'))
    }
  }

  private clearStartTimer(): void {
    if (this.startTimer === undefined) return
    clearTimeout(this.startTimer)
    this.startTimer = undefined
  }

  private emit(status: PlaybackStatus, error?: TextReaderError): void {
    this.onChange({
      status,
      sentenceIndex: this.sentenceIndex,
      sentenceCount: this.sentences.length,
      ...(error ? { error } : {}),
    })
  }
}
