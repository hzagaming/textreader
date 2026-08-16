import { beforeEach, describe, expect, it, vi } from 'vitest'
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

function createSynthesis(endOnCancel = false) {
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
      utterance.onstart?.call(
        utterance as unknown as SpeechSynthesisUtterance,
        {} as SpeechSynthesisEvent,
      )
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
    getVoices: () => [],
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
})
