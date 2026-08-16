import type { ReaderState } from '@textreader/shared'
import type { TextReaderMessage } from '@/services/messaging/protocol'

export function primaryReaderCommand(
  reader: ReaderState,
  hasDocument: boolean,
): TextReaderMessage {
  if (reader.status === 'playing') return { type: 'READER_PAUSE' }
  if (reader.status === 'paused') return { type: 'READER_RESUME' }
  if (reader.resumeAvailable) return { type: 'CONTINUE_READING' }
  if (hasDocument) {
    return {
      type: 'JUMP_TO_SENTENCE',
      payload: { index: reader.progress >= 0.99 ? 0 : reader.currentSentenceIndex },
    }
  }
  return { type: 'READ_CURRENT_SELECTION' }
}
