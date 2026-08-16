import type { ReaderDocument, ReaderSettings, ReaderState } from '@textreader/shared'
import { create } from 'zustand'
import { DEFAULT_SETTINGS } from '@/services/settings/settings'

export function createIdleReaderState(settings: ReaderSettings): ReaderState {
  return {
    status: 'idle',
    source: 'selection',
    text: '',
    currentSentenceIndex: 0,
    currentParagraphIndex: 0,
    sentenceCount: 0,
    progress: 0,
    settings,
  }
}

const INITIAL_READER_STATE: ReaderState = createIdleReaderState(DEFAULT_SETTINGS)

interface ReaderStore {
  reader: ReaderState
  document: ReaderDocument | null
  setReader: (reader: ReaderState) => void
  setDocument: (document: ReaderDocument | null) => void
  patchReader: (reader: Partial<ReaderState>) => void
  resetReader: () => void
}

export const useReaderStore = create<ReaderStore>((set) => ({
  reader: INITIAL_READER_STATE,
  document: null,
  setReader: (reader) => set({ reader }),
  setDocument: (document) => set({ document }),
  patchReader: (patch) => set((state) => ({ reader: { ...state.reader, ...patch } })),
  resetReader: () =>
    set((state) => ({ reader: createIdleReaderState(state.reader.settings) })),
}))
