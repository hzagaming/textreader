// @vitest-environment happy-dom

import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from '@/services/settings/settings'
import { createTranslator } from '@/services/i18n/i18n'
import { useReaderStore } from '@/stores/reader-store'
import { isReaderTabUpdate, isReaderWindowActivation } from './use-reader-connection'

const mocks = vi.hoisted(() => ({
  getSettings: vi.fn(),
}))

vi.mock('@/services/settings/settings', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/services/settings/settings')>()
  return {
    ...original,
    settingsService: {
      get: mocks.getSettings,
      subscribe: vi.fn(() => vi.fn()),
    },
  }
})

vi.mock('@/services/messaging/transport', () => ({
  getActiveTab: vi.fn(() => Promise.resolve(undefined)),
  getReaderDocument: vi.fn(),
  getReaderState: vi.fn(),
}))

vi.mock('@/services/messaging/reader-updates-connection', () => ({
  subscribeToReaderUpdates: vi.fn(() => vi.fn()),
}))

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

    function Probe() {
      useReaderConnection(createTranslator('en'))
      return createElement(
        'span',
        null,
        useReaderStore((state) => state.reader.settings.uiLanguage),
      )
    }

    root.render(createElement(Probe))
    await vi.waitFor(() => expect(document.body.textContent).toContain('zh'))
    root.unmount()
  })
})
