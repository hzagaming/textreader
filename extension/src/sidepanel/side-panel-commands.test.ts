import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '@/services/settings/settings'
import { primaryReaderCommand } from './side-panel-commands'

const baseReader = {
  status: 'idle' as const,
  source: 'selection' as const,
  text: '',
  currentSentenceIndex: 0,
  currentParagraphIndex: 0,
  sentenceCount: 0,
  progress: 0,
  settings: DEFAULT_SETTINGS,
}

describe('primaryReaderCommand', () => {
  it('maps active playback states to pause and resume', () => {
    expect(primaryReaderCommand({ ...baseReader, status: 'playing' }, true)).toEqual({
      type: 'READER_PAUSE',
    })
    expect(primaryReaderCommand({ ...baseReader, status: 'paused' }, true)).toEqual({
      type: 'READER_RESUME',
    })
  })

  it('continues a prepared resume instead of sending an inactive TTS jump', () => {
    expect(
      primaryReaderCommand(
        {
          ...baseReader,
          status: 'stopped',
          progress: 0.45,
          resumeAvailable: true,
          resumeSentenceIndex: 4,
        },
        true,
      ),
    ).toEqual({ type: 'CONTINUE_READING' })
  })

  it('restarts completed playback and starts from the selected text when empty', () => {
    expect(
      primaryReaderCommand(
        { ...baseReader, status: 'stopped', progress: 1, currentSentenceIndex: 8 },
        true,
      ),
    ).toEqual({ type: 'JUMP_TO_SENTENCE', payload: { index: 0 } })
    expect(primaryReaderCommand(baseReader, false)).toEqual({
      type: 'READ_CURRENT_SELECTION',
    })
  })
})
