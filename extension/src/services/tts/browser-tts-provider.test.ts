import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BrowserTTSProvider, type PlaybackSnapshot } from './browser-tts-provider'

class FakeUtterance {
  rate = 1
  pitch = 1
  volume = 1
  lang = ''
  voice: SpeechSynthesisVoice | null = null
  onstart: SpeechSynthesisUtterance['onstart'] = null
  onend: SpeechSynthesisUtterance['onend'] = null
  onerror: SpeechSynthesisUtterance['onerror'] = null

  constructor(public readonly text: string) {}
}

function createSynthesis(
  endOnCancel = false,
  voices: SpeechSynthesisVoice[] = [],
  startImmediately = true,
) {
  const utterances: FakeUtterance[] = []
  let currentUtterance: FakeUtterance | undefined
  const synthesis = {
    speaking: false,
    paused: false,
    pending: false,
    onvoiceschanged: null,
    speak(utterance: FakeUtterance) {
      utterances.push(utterance)
      currentUtterance = utterance
      this.speaking = true
      if (startImmediately) {
        utterance.onstart?.call(
          utterance as unknown as SpeechSynthesisUtterance,
          {} as SpeechSynthesisEvent,
        )
      }
    },
    cancel() {
      this.speaking = false
      this.paused = false
      if (endOnCancel) {
        currentUtterance?.onend?.call(
          currentUtterance as unknown as SpeechSynthesisUtterance,
          {} as SpeechSynthesisEvent,
        )
      }
    },
    pause() {
      this.paused = true
    },
    resume() {
      this.paused = false
    },
    getVoices: () => voices,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(() => true),
  }

  return { synthesis: synthesis as unknown as SpeechSynthesis, utterances }
}

describe('BrowserTTSProvider', () => {
  beforeEach(() => {
    vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance)
  })

  afterEach(() => vi.useRealTimers())

  it('reads sentence-by-sentence and reports completion', async () => {
    const snapshots: PlaybackSnapshot[] = []
    const { synthesis, utterances } = createSynthesis()
    const provider = new BrowserTTSProvider(synthesis, (snapshot) =>
      snapshots.push(snapshot),
    )

    await provider.speak({
      text: 'First sentence. Second sentence.',
      rate: 1.2,
      pitch: 25,
      volume: 0.8,
    })

    expect(utterances[0]).toMatchObject({
      text: 'First sentence.',
      rate: 1.2,
      pitch: 1.5,
      volume: 0.8,
    })
    utterances[0]?.onend?.call(
      utterances[0] as unknown as SpeechSynthesisUtterance,
      {} as SpeechSynthesisEvent,
    )
    expect(utterances[1]?.text).toBe('Second sentence.')
    utterances[1]?.onend?.call(
      utterances[1] as unknown as SpeechSynthesisUtterance,
      {} as SpeechSynthesisEvent,
    )
    expect(snapshots.at(-1)).toMatchObject({
      status: 'finished',
      sentenceIndex: 1,
      sentenceCount: 2,
    })
  })

  it('adds subtle sentence-aware expression when enabled', async () => {
    const { synthesis, utterances } = createSynthesis()
    const provider = new BrowserTTSProvider(synthesis, vi.fn())

    await provider.speak({
      text: 'Are you ready? Wonderful! Let me think…',
      sentences: ['Are you ready?', 'Wonderful!', 'Let me think…'],
      rate: 1,
      pitch: 0,
      volume: 0.8,
      naturalExpression: true,
    })

    expect(utterances[0]).toMatchObject({ rate: 0.97, pitch: 1.08, volume: 0.8 })
    utterances[0]?.onend?.call(
      utterances[0] as unknown as SpeechSynthesisUtterance,
      {} as SpeechSynthesisEvent,
    )
    expect(utterances[1]).toMatchObject({ rate: 1.03, pitch: 1.06, volume: 0.82 })
    utterances[1]?.onend?.call(
      utterances[1] as unknown as SpeechSynthesisUtterance,
      {} as SpeechSynthesisEvent,
    )
    expect(utterances[2]).toMatchObject({ rate: 0.92, pitch: 0.96, volume: 0.8 })
  })

  it('keeps the configured voice controls unchanged when expression is disabled', async () => {
    const { synthesis, utterances } = createSynthesis()
    const provider = new BrowserTTSProvider(synthesis, vi.fn())

    await provider.speak({
      text: 'Really?',
      rate: 1.4,
      pitch: 20,
      volume: 0.7,
      naturalExpression: false,
    })

    expect(utterances[0]).toMatchObject({ rate: 1.4, pitch: 1.4, volume: 0.7 })
  })

  it('delegates pause, resume, and stop to the browser engine', async () => {
    const { synthesis } = createSynthesis()
    const provider = new BrowserTTSProvider(synthesis, vi.fn())
    await provider.speak({ text: 'Read this.', rate: 1, pitch: 0, volume: 1 })

    provider.pause()
    expect(synthesis.paused).toBe(true)
    provider.resume()
    expect(synthesis.paused).toBe(false)
    provider.stop()
    expect(synthesis.speaking).toBe(false)
  })

  it('normalizes an invalid starting sentence index', async () => {
    const { synthesis, utterances } = createSynthesis()
    const provider = new BrowserTTSProvider(synthesis, vi.fn())

    await provider.speak({
      text: 'First sentence. Second sentence.',
      sentences: ['First sentence.', 'Second sentence.'],
      rate: 1,
      pitch: 0,
      volume: 1,
      startSentenceIndex: Number.NaN,
    })

    expect(utterances[0]?.text).toBe('First sentence.')
  })

  it('ignores a synchronous stale end event while jumping', async () => {
    const snapshots: PlaybackSnapshot[] = []
    const { synthesis, utterances } = createSynthesis(true)
    const provider = new BrowserTTSProvider(synthesis, (snapshot) =>
      snapshots.push(snapshot),
    )
    await provider.speak({
      text: 'First sentence. Second sentence.',
      sentences: ['First sentence.', 'Second sentence.'],
      rate: 1,
      pitch: 0,
      volume: 1,
    })
    snapshots.length = 0

    provider.jumpToSentence(1)

    expect(utterances.at(-1)?.text).toBe('Second sentence.')
    expect(snapshots.some((snapshot) => snapshot.status === 'finished')).toBe(false)
  })

  it('automatically switches language and mapped voice between sentences', async () => {
    const english = {
      name: 'English',
      lang: 'en-US',
      voiceURI: 'voice-en',
      default: true,
      localService: true,
    } as SpeechSynthesisVoice
    const chinese = {
      name: 'Chinese',
      lang: 'zh-CN',
      voiceURI: 'voice-zh',
      default: false,
      localService: true,
    } as SpeechSynthesisVoice
    const { synthesis, utterances } = createSynthesis(false, [english, chinese])
    const provider = new BrowserTTSProvider(synthesis, vi.fn())

    await provider.speak({
      text: 'Hello. 你好。',
      sentences: ['Hello.', '你好。'],
      rate: 1,
      pitch: 0,
      volume: 1,
      readingLanguage: 'auto',
      voiceByLanguage: { zh: chinese.voiceURI },
    })

    expect(utterances[0]).toMatchObject({ lang: 'en-US', voice: english })
    utterances[0]?.onend?.call(
      utterances[0] as unknown as SpeechSynthesisUtterance,
      {} as SpeechSynthesisEvent,
    )
    expect(utterances[1]).toMatchObject({ lang: 'zh-CN', voice: chinese })
  })

  it('reports an error when the browser voice never starts', async () => {
    vi.useFakeTimers()
    const snapshots: PlaybackSnapshot[] = []
    const { synthesis } = createSynthesis(false, [], false)
    const provider = new BrowserTTSProvider(synthesis, (snapshot) =>
      snapshots.push(snapshot),
    )

    await provider.speak({ text: 'Read this.', rate: 1, pitch: 0, volume: 1 })
    await vi.advanceTimersByTimeAsync(10_000)

    expect(synthesis.speaking).toBe(false)
    expect(snapshots.at(-1)).toMatchObject({
      status: 'error',
      error: { code: 'TTS_ERROR' },
    })
  })

  it('recovers when a started browser voice never finishes', async () => {
    vi.useFakeTimers()
    const snapshots: PlaybackSnapshot[] = []
    const { synthesis } = createSynthesis()
    const provider = new BrowserTTSProvider(synthesis, (snapshot) =>
      snapshots.push(snapshot),
    )

    await provider.speak({ text: 'Read this.', rate: 1, pitch: 0, volume: 1 })
    await vi.advanceTimersByTimeAsync(45_000)

    expect(synthesis.speaking).toBe(false)
    expect(snapshots.at(-1)).toMatchObject({
      status: 'error',
      error: { code: 'TTS_ERROR' },
    })
  })

  it('does not time out while playback is paused', async () => {
    vi.useFakeTimers()
    const snapshots: PlaybackSnapshot[] = []
    const { synthesis } = createSynthesis()
    const provider = new BrowserTTSProvider(synthesis, (snapshot) =>
      snapshots.push(snapshot),
    )

    await provider.speak({ text: 'Read this.', rate: 1, pitch: 0, volume: 1 })
    provider.pause()
    await vi.advanceTimersByTimeAsync(45_000)

    expect(snapshots.at(-1)?.status).toBe('paused')
    expect(synthesis.speaking).toBe(true)
  })

  it('clears the startup timeout when playback is stopped', async () => {
    vi.useFakeTimers()
    const snapshots: PlaybackSnapshot[] = []
    const { synthesis } = createSynthesis(false, [], false)
    const provider = new BrowserTTSProvider(synthesis, (snapshot) =>
      snapshots.push(snapshot),
    )

    await provider.speak({ text: 'Read this.', rate: 1, pitch: 0, volume: 1 })
    provider.stop()
    await vi.advanceTimersByTimeAsync(10_000)

    expect(snapshots).toHaveLength(1)
    expect(snapshots[0]?.status).toBe('stopped')
  })

  it('ignores a late end event after a playback error', async () => {
    const snapshots: PlaybackSnapshot[] = []
    const { synthesis, utterances } = createSynthesis()
    const provider = new BrowserTTSProvider(synthesis, (snapshot) =>
      snapshots.push(snapshot),
    )

    await provider.speak({ text: 'Read this.', rate: 1, pitch: 0, volume: 1 })
    utterances[0]?.onerror?.call(
      utterances[0] as unknown as SpeechSynthesisUtterance,
      { error: 'synthesis-failed' } as SpeechSynthesisErrorEvent,
    )
    utterances[0]?.onend?.call(
      utterances[0] as unknown as SpeechSynthesisUtterance,
      {} as SpeechSynthesisEvent,
    )

    expect(snapshots.at(-1)?.status).toBe('error')
  })

  it('reports an unexpected browser interruption instead of leaving stale state', async () => {
    const snapshots: PlaybackSnapshot[] = []
    const { synthesis, utterances } = createSynthesis()
    const provider = new BrowserTTSProvider(synthesis, (snapshot) =>
      snapshots.push(snapshot),
    )

    await provider.speak({ text: 'Read this.', rate: 1, pitch: 0, volume: 1 })
    utterances[0]?.onerror?.call(
      utterances[0] as unknown as SpeechSynthesisUtterance,
      { error: 'interrupted' } as SpeechSynthesisErrorEvent,
    )

    expect(snapshots.at(-1)).toMatchObject({
      status: 'error',
      error: { code: 'TTS_ERROR' },
    })
  })
})
