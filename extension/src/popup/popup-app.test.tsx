// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from '@/services/settings/settings'
import { PopupApp } from './popup-app'

const mocks = vi.hoisted(() => ({
  getSettings: vi.fn(),
  updateSettings: vi.fn(),
  getActiveReaderState: vi.fn(),
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
  getActiveReaderState: mocks.getActiveReaderState,
  sendRuntimeMessage: vi.fn(),
}))

let root: Root | undefined

beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  vi.stubGlobal('chrome', {
    tabs: {
      query: vi.fn().mockResolvedValue([{ id: 1, title: 'Example' }]),
    },
  })
  mocks.getActiveReaderState.mockResolvedValue({ ok: true })
  mocks.updateSettings.mockResolvedValue(DEFAULT_SETTINGS)
})

afterEach(() => {
  if (root) act(() => root?.unmount())
  root = undefined
  document.body.replaceChildren()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

describe('PopupApp', () => {
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
})
