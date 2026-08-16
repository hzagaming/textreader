import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '@/services/settings/settings'
import { createIdleReaderState } from './reader-store'

describe('createIdleReaderState', () => {
  it('clears tab-specific playback state while preserving local settings', () => {
    const settings = { ...DEFAULT_SETTINGS, speed: 1.4, theme: 'dark' as const }

    expect(createIdleReaderState(settings)).toEqual({
      status: 'idle',
      source: 'selection',
      text: '',
      currentSentenceIndex: 0,
      currentParagraphIndex: 0,
      sentenceCount: 0,
      progress: 0,
      settings,
    })
  })
})
