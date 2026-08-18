// @vitest-environment happy-dom

import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReaderSettings } from '@textreader/shared'
import { DEFAULT_SETTINGS } from '@/services/settings/settings'
import { createTranslator } from '@/services/i18n/i18n'
import { createIdleReaderState, useReaderStore } from '@/stores/reader-store'
import { isReaderTabUpdate, isReaderWindowActivation } from './use-reader-connection'

const mocks = vi.hoisted(() => ({
  getSettings: vi.fn(),
  subscribeSettings: vi.fn<(listener: (settings: ReaderSettings) => void) => () => void>(
    () => vi.fn(),
  ),
  getActiveTab: vi.fn<() => Promise<{ id: number; windowId: number } | undefined>>(() =>
    Promise.resolve(undefined),
  ),
  getReaderDocument: vi.fn(),
  getReaderState: vi.fn(),
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

vi.mock('@/services/messaging/transport', () => ({
  getActiveTab: mocks.getActiveTab,
  getReaderDocument: mocks.getReaderDocument,
  getReaderState: mocks.getReaderState,
}))

vi.mock('@/services/messaging/reader-updates-connection', () => ({
  subscribeToReaderUpdates: vi.fn(() => vi.fn()),
}))

beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  mocks.getSettings.mockReset()
  mocks.subscribeSettings.mockReset().mockImplementation(() => vi.fn())
  mocks.getActiveTab.mockReset().mockResolvedValue(undefined)
  mocks.getReaderDocument.mockReset()
  mocks.getReaderState.mockReset()
})

afterEach(() => {
  document.body.replaceChildren()
  useReaderStore.getState().patchReader({ settings: DEFAULT_SETTINGS })
  useReaderStore.getState().resetReader()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

describe('reader tab event filtering', () => {
  it('accepts activation only from the Side Panel window', () => {
    expect(isReaderWindowActivation(4, 4)).toBe(true)
    expect(isReaderWindowActivation(4, 9)).toBe(false)
  })

  it('refreshes only meaningful updates for the connected tab', () => {
    expect(isReaderTabUpdate(12, 12, { status: 'complete' })).toBe(true)
    expect(isReaderTabUpdate(12, 12, { title: 'Renamed' })).toBe(false)
    expect(isReaderTabUpdate(12, 13, { url: 'https://example.com' })).toBe(false)
  })
})

describe('reader settings initialization', () => {
  it('loads local settings when the active page cannot provide reader state', async () => {
    mocks.getSettings.mockResolvedValue({ ...DEFAULT_SETTINGS, uiLanguage: 'zh' })
    vi.stubGlobal('chrome', {
      tabs: {
        onActivated: { addListener: vi.fn(), removeListener: vi.fn() },
        onUpdated: { addListener: vi.fn(), removeListener: vi.fn() },
      },
    })
    const { useReaderConnection } = await import('./use-reader-connection')
    const root = createRoot(document.body.appendChild(document.createElement('div')))
    const translator = createTranslator('en')

    function Probe() {
      useReaderConnection(translator)
      return createElement(
        'span',
        null,
        useReaderStore((state) => state.reader.settings.uiLanguage),
      )
    }

    await act(async () => {
      root.render(createElement(Probe))
      await Promise.resolve()
    })
    await vi.waitFor(() => expect(document.body.textContent).toContain('zh'))
    act(() => root.unmount())
  })

  it('does not overwrite a subscription update with a stale initial read', async () => {
    let resolveInitial: ((settings: ReaderSettings) => void) | undefined
    let emitSettings: ((settings: ReaderSettings) => void) | undefined
    const initialRead = new Promise<ReaderSettings>((resolve) => {
      resolveInitial = resolve
    })
    mocks.getSettings.mockReturnValueOnce(initialRead)
    mocks.subscribeSettings.mockImplementationOnce(
      (listener: (settings: ReaderSettings) => void) => {
        emitSettings = listener
        return vi.fn()
      },
    )
    vi.stubGlobal('chrome', {
      tabs: {
        onActivated: { addListener: vi.fn(), removeListener: vi.fn() },
        onUpdated: { addListener: vi.fn(), removeListener: vi.fn() },
      },
    })
    const { useReaderConnection } = await import('./use-reader-connection')
    const root = createRoot(document.body.appendChild(document.createElement('div')))
    const translator = createTranslator('en')

    function Probe() {
      useReaderConnection(translator)
      return createElement(
        'span',
        null,
        useReaderStore((state) => state.reader.settings.uiLanguage),
      )
    }

    await act(async () => {
      root.render(createElement(Probe))
      await Promise.resolve()
    })
    await vi.waitFor(() => expect(emitSettings).toBeTypeOf('function'))
    await act(async () => {
      emitSettings?.({ ...DEFAULT_SETTINGS, uiLanguage: 'zh' })
      resolveInitial?.({ ...DEFAULT_SETTINGS, uiLanguage: 'en' })
      await initialRead
    })

    expect(useReaderStore.getState().reader.settings.uiLanguage).toBe('zh')
    expect(document.body.textContent).toContain('zh')
    act(() => root.unmount())
  })

  it('keeps newer local settings when a stale page state arrives later', async () => {
    let resolveState:
      | ((response: { ok: true; data: ReturnType<typeof createIdleReaderState> }) => void)
      | undefined
    mocks.getSettings.mockResolvedValueOnce({
      ...DEFAULT_SETTINGS,
      uiLanguage: 'zh',
    })
    mocks.getActiveTab.mockResolvedValueOnce({ id: 4, windowId: 1 })
    mocks.getReaderState.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveState = resolve
      }),
    )
    mocks.getReaderDocument.mockResolvedValueOnce({
      ok: false,
      error: { code: 'EMPTY_TEXT', message: 'No document' },
    })
    vi.stubGlobal('chrome', {
      tabs: {
        onActivated: { addListener: vi.fn(), removeListener: vi.fn() },
        onUpdated: { addListener: vi.fn(), removeListener: vi.fn() },
      },
    })
    const { useReaderConnection } = await import('./use-reader-connection')
    const root = createRoot(document.body.appendChild(document.createElement('div')))
    const translator = createTranslator('en')

    function Probe() {
      useReaderConnection(translator)
      return createElement(
        'span',
        null,
        useReaderStore((state) => state.reader.settings.uiLanguage),
      )
    }

    await act(async () => {
      root.render(createElement(Probe))
      await Promise.resolve()
    })
    await vi.waitFor(() =>
      expect(useReaderStore.getState().reader.settings.uiLanguage).toBe('zh'),
    )
    await act(async () => {
      resolveState?.({
        ok: true,
        data: createIdleReaderState({ ...DEFAULT_SETTINGS, uiLanguage: 'en' }),
      })
      await Promise.resolve()
    })

    expect(useReaderStore.getState().reader.settings.uiLanguage).toBe('zh')
    act(() => root.unmount())
  })
})
