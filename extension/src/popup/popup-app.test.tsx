// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from '@/services/settings/settings'
import { PopupApp } from './popup-app'

const mocks = vi.hoisted(() => ({
  getSettings: vi.fn(),
  updateSettings: vi.fn(),
  getReaderState: vi.fn(),
  sendRuntimeMessage: vi.fn(),
}))

vi.mock('@/services/settings/settings', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/services/settings/settings')>()
  return {
    ...original,
    settingsService: {
      get: mocks.getSettings,
      update: mocks.updateSettings,
    },
  }
})

vi.mock('@/services/messaging/transport', () => ({
  getReaderState: mocks.getReaderState,
  sendRuntimeMessage: mocks.sendRuntimeMessage,
  updateSettings: mocks.updateSettings,
}))

let root: Root | undefined

beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  vi.stubGlobal('chrome', {
    i18n: { getUILanguage: vi.fn(() => 'en-US') },
    tabs: {
      query: vi.fn().mockResolvedValue([{ id: 1, title: 'Example' }]),
    },
  })
  mocks.getSettings.mockResolvedValue(DEFAULT_SETTINGS)
  mocks.getReaderState.mockResolvedValue({ ok: true })
  mocks.updateSettings.mockResolvedValue(DEFAULT_SETTINGS)
  mocks.sendRuntimeMessage.mockResolvedValue({ ok: true })
})

afterEach(() => {
  if (root) act(() => root?.unmount())
  root = undefined
  document.body.replaceChildren()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

describe('PopupApp', () => {
  it('uses the shared entrance motion without changing popup semantics', async () => {
    root = createRoot(document.body.appendChild(document.createElement('div')))

    await act(async () => {
      root?.render(<PopupApp />)
      await Promise.resolve()
    })

    expect(document.querySelector('main')?.className).toContain('tr-app-enter')
  })

  it('preserves the authored capitalization of localized status text', async () => {
    root = createRoot(document.body.appendChild(document.createElement('div')))

    await act(async () => {
      root?.render(<PopupApp />)
      await Promise.resolve()
    })

    const status = [...document.querySelectorAll('p')].find(
      (candidate) => candidate.textContent === 'Ready to read',
    )
    expect(status).toBeDefined()
    expect(status?.className).not.toContain('capitalize')
  })

  it('loads the reader state from the same tab used for the visible title', async () => {
    const query = chrome.tabs.query as unknown as ReturnType<typeof vi.fn>
    query.mockResolvedValue([{ id: 42, title: 'Bound page' } as chrome.tabs.Tab])
    root = createRoot(document.body.appendChild(document.createElement('div')))

    await act(async () => {
      root?.render(<PopupApp />)
      await Promise.resolve()
    })

    await vi.waitFor(() => expect(mocks.getReaderState).toHaveBeenCalledWith(42))
    expect(document.body.textContent).toContain('Bound page')
  })

  it('keeps the selection switch disabled until settings finish loading', async () => {
    let resolveSettings: ((settings: typeof DEFAULT_SETTINGS) => void) | undefined
    mocks.getSettings.mockReturnValue(
      new Promise((resolve) => {
        resolveSettings = resolve
      }),
    )
    root = createRoot(document.body.appendChild(document.createElement('div')))
    act(() => root?.render(<PopupApp />))
    const selectionSwitch = document.querySelector('button[role="switch"]')

    expect(selectionSwitch).toBeInstanceOf(HTMLButtonElement)
    expect((selectionSwitch as HTMLButtonElement).disabled).toBe(true)

    await act(async () => {
      resolveSettings?.(DEFAULT_SETTINGS)
      await Promise.resolve()
    })

    expect((selectionSwitch as HTMLButtonElement).disabled).toBe(false)
  })

  it('keeps loaded settings when the active tab lookup fails', async () => {
    vi.mocked(chrome.tabs.query).mockRejectedValue(new Error('tab lookup failed'))
    mocks.getSettings.mockResolvedValue({
      ...DEFAULT_SETTINGS,
      autoShowSelectionButton: false,
    })
    root = createRoot(document.body.appendChild(document.createElement('div')))

    await act(async () => {
      root?.render(<PopupApp />)
      await Promise.resolve()
    })

    const selectionSwitch = document.querySelector('button[role="switch"]')
    expect(selectionSwitch).toBeInstanceOf(HTMLButtonElement)
    await vi.waitFor(() =>
      expect((selectionSwitch as HTMLButtonElement).disabled).toBe(false),
    )
    expect(selectionSwitch?.getAttribute('aria-checked')).toBe('false')
    expect(document.querySelector('[role="alert"]')?.textContent).toContain(
      'Unable to load',
    )
  })

  it('keeps the selection switch disabled when settings cannot be loaded', async () => {
    mocks.getSettings.mockRejectedValue(new Error('storage failed'))
    root = createRoot(document.body.appendChild(document.createElement('div')))

    await act(async () => {
      root?.render(<PopupApp />)
      await Promise.resolve()
    })

    const selectionSwitch = document.querySelector('button[role="switch"]')
    expect(selectionSwitch).toBeInstanceOf(HTMLButtonElement)
    await vi.waitFor(() =>
      expect(document.querySelector('[role="alert"]')).not.toBeNull(),
    )
    expect((selectionSwitch as HTMLButtonElement).disabled).toBe(true)
  })

  it('keeps the initial interface English when storage fails on a Chinese browser', async () => {
    vi.mocked(chrome.i18n.getUILanguage).mockReturnValue('zh-CN')
    mocks.getSettings.mockRejectedValue(new Error('storage failed'))
    root = createRoot(document.body.appendChild(document.createElement('div')))

    await act(async () => {
      root?.render(<PopupApp />)
      await Promise.resolve()
    })

    await vi.waitFor(() =>
      expect(document.querySelector('[role="alert"]')).not.toBeNull(),
    )
    expect(document.body.textContent).toContain('Open Reader')
    expect(document.body.textContent).not.toContain('打开阅读器')
  })

  it('shows the page error returned by the content connection', async () => {
    mocks.getReaderState.mockResolvedValue({
      ok: false,
      error: {
        code: 'UNSUPPORTED_PAGE',
        message: 'TextReader cannot run on this browser page.',
      },
    })
    root = createRoot(document.body.appendChild(document.createElement('div')))

    await act(async () => {
      root?.render(<PopupApp />)
      await Promise.resolve()
    })

    await vi.waitFor(() =>
      expect(document.querySelector('[role="alert"]')?.textContent).toContain(
        'not available on this page',
      ),
    )
    expect(document.body.textContent).toContain('Error')
    const openReaderButton = [...document.querySelectorAll('button')].find(
      (candidate) => candidate.textContent?.trim() === 'Open Reader',
    )
    expect(openReaderButton).toBeInstanceOf(HTMLButtonElement)
    expect((openReaderButton as HTMLButtonElement).disabled).toBe(true)
  })
})
