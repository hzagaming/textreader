// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReaderSettings } from '@textreader/shared'
import { DEFAULT_SETTINGS } from '@/services/settings/settings'
import type { SettingsPatch } from '@/services/settings/settings-update-queue'
import { OptionsApp } from './options-app'

const mocks = vi.hoisted(() => ({
  getSettings: vi.fn<() => Promise<ReaderSettings>>(),
  subscribeSettings: vi.fn(),
  updateSettings: vi.fn(),
}))

vi.mock('@/services/messaging/transport', () => ({
  updateSettings: mocks.updateSettings,
}))

vi.mock('@/services/settings/settings', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/services/settings/settings')>()
  return {
    ...original,
    settingsService: {
      get: mocks.getSettings,
      subscribe: mocks.subscribeSettings,
      update: vi.fn(),
    },
  }
})

let root: Root | undefined

beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  vi.stubGlobal('chrome', {
    runtime: { getManifest: () => ({ version: '1.1.1' }) },
    tabs: { create: vi.fn() },
  })
  mocks.getSettings.mockResolvedValue(DEFAULT_SETTINGS)
  mocks.subscribeSettings.mockReturnValue(vi.fn())
  mocks.updateSettings.mockImplementation((patch: SettingsPatch) =>
    Promise.resolve({ ...DEFAULT_SETTINGS, ...patch }),
  )
})

afterEach(() => {
  if (root) act(() => root?.unmount())
  root = undefined
  document.body.replaceChildren()
  document.documentElement.lang = ''
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

describe('OptionsApp settings initialization', () => {
  it('does not overwrite a subscription update with a stale initial read', async () => {
    let resolveInitial: ((settings: ReaderSettings) => void) | undefined
    let emitSettings: ((settings: ReaderSettings) => void) | undefined
    mocks.getSettings.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveInitial = resolve
      }),
    )
    mocks.subscribeSettings.mockImplementationOnce(
      (listener: (settings: ReaderSettings) => void) => {
        emitSettings = listener
        return vi.fn()
      },
    )
    root = createRoot(document.body.appendChild(document.createElement('div')))
    await act(async () => {
      root?.render(<OptionsApp />)
      await Promise.resolve()
    })

    await act(async () => {
      emitSettings?.({ ...DEFAULT_SETTINGS, uiLanguage: 'zh' })
      resolveInitial?.({ ...DEFAULT_SETTINGS, uiLanguage: 'en' })
      await Promise.resolve()
    })

    expect(document.documentElement.lang).toBe('zh')
  })

  it('does not show a stale load error after settings arrive from storage events', async () => {
    let rejectInitial: ((reason: Error) => void) | undefined
    let emitSettings: ((settings: ReaderSettings) => void) | undefined
    mocks.getSettings.mockReturnValueOnce(
      new Promise((_resolve, reject) => {
        rejectInitial = reject
      }),
    )
    mocks.subscribeSettings.mockImplementationOnce(
      (listener: (settings: ReaderSettings) => void) => {
        emitSettings = listener
        return vi.fn()
      },
    )
    root = createRoot(document.body.appendChild(document.createElement('div')))
    await act(async () => {
      root?.render(<OptionsApp />)
      await Promise.resolve()
    })

    await act(async () => {
      emitSettings?.({ ...DEFAULT_SETTINGS, uiLanguage: 'zh' })
      rejectInitial?.(new Error('stale read failed'))
      await Promise.resolve()
    })

    expect(document.querySelector('header > span')?.textContent).toBe('v1.1.1')
  })

  it('applies rapid repeated switch clicks to the latest saved settings', async () => {
    root = createRoot(document.body.appendChild(document.createElement('div')))
    await act(async () => {
      root?.render(<OptionsApp />)
      await Promise.resolve()
    })
    const expressionSwitch = document.querySelector(
      'button[role="switch"][aria-label="Natural expression"]',
    )
    if (!(expressionSwitch instanceof HTMLButtonElement))
      throw new Error('Missing natural expression switch')

    act(() => {
      expressionSwitch.click()
      expressionSwitch.click()
    })

    await act(async () => {
      await vi.waitFor(() => expect(mocks.updateSettings).toHaveBeenCalledTimes(2))
    })
    expect(mocks.updateSettings).toHaveBeenNthCalledWith(1, {
      naturalExpression: false,
    })
    expect(mocks.updateSettings).toHaveBeenNthCalledWith(2, {
      naturalExpression: true,
    })
  })
})
