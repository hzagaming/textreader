// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReaderSettings } from '@textreader/shared'
import { DEFAULT_SETTINGS } from '@/services/settings/settings'
import { ContentReaderController } from './reader-controller'

const mocks = vi.hoisted(() => ({
  selectionStart: vi.fn(),
  selectionStop: vi.fn(),
  setLanguage: vi.fn(),
  getSettings: vi.fn<() => Promise<ReaderSettings>>(),
  subscribeSettings: vi.fn(),
  getProgress: vi.fn(),
}))

vi.mock('./selection-manager', () => ({
  SelectionManager: class {
    start() {
      mocks.selectionStart()
    }
    stop() {
      mocks.selectionStop()
    }
    getCurrent() {
      return null
    }
    getCurrentRange() {
      return null
    }
  },
}))

vi.mock('./floating-button', () => ({
  SelectionFloatingButton: class {
    setLanguage(language: ReaderSettings['uiLanguage']) {
      mocks.setLanguage(language)
    }
    show() {}
    hide() {}
    destroy() {}
  },
}))

vi.mock('@/services/highlight/highlight-manager', () => ({
  HighlightManager: class {
    rebuild() {}
    createScope() {
      return undefined
    }
    clear() {}
    show() {}
    destroy() {}
  },
}))

vi.mock('@/services/settings/settings', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/services/settings/settings')>()
  return {
    ...original,
    settingsService: {
      get: mocks.getSettings,
      subscribe: mocks.subscribeSettings,
    },
  }
})

vi.mock('@/services/progress/reading-progress', () => ({
  readingProgressService: {
    get: mocks.getProgress,
    save: vi.fn(),
    clear: vi.fn(),
  },
}))

vi.mock('@/services/messaging/transport', () => ({
  sendRuntimeMessage: vi.fn().mockResolvedValue({ ok: true }),
}))

beforeEach(() => {
  vi.stubGlobal('speechSynthesis', {
    speaking: false,
    paused: false,
    pending: false,
    speak: vi.fn(),
    cancel: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    getVoices: vi.fn(() => []),
  })
  vi.stubGlobal('chrome', {
    runtime: {
      onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
    },
  })
})

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

describe('ContentReaderController startup', () => {
  it('listens for selections and setting changes before storage reads finish', async () => {
    let resolveSettings: ((settings: ReaderSettings) => void) | undefined
    let resolveProgress: (() => void) | undefined
    let emitSettings: ((settings: ReaderSettings) => void) | undefined
    mocks.getSettings.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveSettings = resolve
      }),
    )
    mocks.getProgress.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolveProgress = resolve
      }),
    )
    mocks.subscribeSettings.mockImplementationOnce(
      (listener: (settings: ReaderSettings) => void) => {
        emitSettings = listener
        return vi.fn()
      },
    )
    const controller = new ContentReaderController()
    const starting = controller.start()
    const selectionStartedImmediately = mocks.selectionStart.mock.calls.length === 1
    const subscribedImmediately = typeof emitSettings === 'function'
    emitSettings?.({ ...DEFAULT_SETTINGS, uiLanguage: 'zh' })
    resolveSettings?.({ ...DEFAULT_SETTINGS, uiLanguage: 'en' })
    resolveProgress?.()
    await starting

    expect(selectionStartedImmediately).toBe(true)
    expect(subscribedImmediately).toBe(true)
    expect(mocks.setLanguage).toHaveBeenLastCalledWith('zh')
    controller.stop()
  })
})
