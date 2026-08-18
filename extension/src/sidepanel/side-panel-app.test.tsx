// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MessageResponse } from '@/services/messaging/protocol'
import { DEFAULT_SETTINGS } from '@/services/settings/settings'
import { createIdleReaderState, useReaderStore } from '@/stores/reader-store'
import { SidePanelApp } from './side-panel-app'

const mocks = vi.hoisted(() => ({
  sendToActiveTab: vi.fn(),
  updateSettings: vi.fn(),
}))

vi.mock('@/hooks/use-reader-connection', () => ({
  isReaderWindowActivation: vi.fn(() => true),
  useReaderConnection: vi.fn(() => ''),
}))

vi.mock('@/services/messaging/transport', () => ({
  sendToActiveTab: mocks.sendToActiveTab,
}))

vi.mock('@/services/settings/settings', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/services/settings/settings')>()
  return {
    ...original,
    settingsService: { update: mocks.updateSettings },
  }
})

class FakeUtterance {
  rate = 1
  pitch = 1
  volume = 1
  lang = ''
  voice: SpeechSynthesisVoice | null = null
  onstart: SpeechSynthesisUtterance['onstart'] = null
  onend: SpeechSynthesisUtterance['onend'] = null
  onerror: SpeechSynthesisUtterance['onerror'] = null

  constructor(public readonly text: string) {}
}

const voice = {
  name: 'Local English',
  lang: 'en-US',
  voiceURI: 'voice-en',
  default: true,
  localService: true,
} as SpeechSynthesisVoice

let root: Root | undefined
let speak: ReturnType<typeof vi.fn>
let cancel: ReturnType<typeof vi.fn>

function button(label: string): HTMLButtonElement {
  const match = [...document.querySelectorAll('button')].find(
    (candidate) =>
      candidate.textContent?.trim() === label ||
      candidate.getAttribute('aria-label') === label,
  )
  if (!(match instanceof HTMLButtonElement)) throw new Error(`Missing button: ${label}`)
  return match
}

async function renderApp(withDocument = false, openVoiceSettings = true): Promise<void> {
  if (withDocument) {
    useReaderStore.getState().setDocument({
      id: 'document-1',
      url: 'https://example.com',
      title: 'Example',
      paragraphs: [],
      plainText: 'Read this.',
      createdAt: 1,
    })
  }
  root = createRoot(document.body.appendChild(document.createElement('div')))
  await act(async () => {
    root?.render(<SidePanelApp />)
    await Promise.resolve()
  })
  if (!openVoiceSettings) return
  act(() => button('Voice & reading settings').click())
  await vi.waitFor(() => expect(button('Preview voice').disabled).toBe(false))
}

beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  speak = vi.fn()
  cancel = vi.fn()
  vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance)
  vi.stubGlobal('speechSynthesis', {
    speaking: false,
    paused: false,
    pending: false,
    speak,
    cancel,
    pause: vi.fn(),
    resume: vi.fn(),
    getVoices: vi.fn(() => [voice]),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })
  vi.stubGlobal('chrome', {
    runtime: { openOptionsPage: vi.fn() },
    tabs: {
      query: vi.fn().mockResolvedValue([{ id: 1, windowId: 1, title: 'Example' }]),
      onActivated: { addListener: vi.fn(), removeListener: vi.fn() },
      onUpdated: { addListener: vi.fn(), removeListener: vi.fn() },
    },
  })
  mocks.sendToActiveTab.mockResolvedValue({ ok: true })
  mocks.updateSettings.mockResolvedValue(DEFAULT_SETTINGS)
  useReaderStore.getState().setReader(createIdleReaderState(DEFAULT_SETTINGS))
  useReaderStore.getState().setDocument(null)
})

afterEach(() => {
  if (root) act(() => root?.unmount())
  root = undefined
  document.body.replaceChildren()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

describe('SidePanel voice preview', () => {
  it('gives the voice settings panel the reader workspace while it is open', async () => {
    await renderApp(false, false)
    const settingsButton = button('Voice & reading settings')

    expect(document.querySelector('[data-reader-controls]')?.className).toContain(
      'hidden',
    )

    act(() => settingsButton.click())

    expect(document.querySelector('[data-reader-content]')?.className).toContain('hidden')
    expect(document.querySelector('[data-reader-controls]')?.className).toContain(
      'hidden',
    )
    expect(settingsButton.parentElement?.className).toContain('flex-1')
    expect(settingsButton.getAttribute('aria-expanded')).toBe('true')
  })

  it('lets the user disable natural expression', async () => {
    await renderApp()
    const expressionSwitch = document.querySelector(
      'button[role="switch"][aria-label="Natural expression"]',
    )
    if (!(expressionSwitch instanceof HTMLButtonElement))
      throw new Error('Missing natural expression switch')

    await act(async () => {
      expressionSwitch.click()
      await Promise.resolve()
    })

    expect(mocks.updateSettings).toHaveBeenCalledWith({ naturalExpression: false })
  })

  it('demonstrates natural expression in the voice preview', async () => {
    await renderApp()

    await act(async () => {
      button('Preview voice').click()
      await Promise.resolve()
    })

    const utterance = speak.mock.calls[0]?.[0] as FakeUtterance | undefined
    expect(utterance).toMatchObject({ rate: 0.97, pitch: 1.08 })
  })

  it('can cancel a preview while the reader stop request is still pending', async () => {
    let resolveStop: ((response: MessageResponse) => void) | undefined
    mocks.sendToActiveTab.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveStop = resolve
      }),
    )
    await renderApp()

    await act(async () => {
      button('Preview voice').click()
      await Promise.resolve()
    })
    expect(button('Stop preview').getAttribute('aria-pressed')).toBe('true')
    act(() => button('Stop preview').click())
    await act(async () => {
      resolveStop?.({ ok: true })
      await Promise.resolve()
    })

    expect(speak).not.toHaveBeenCalled()
    expect(button('Preview voice').getAttribute('aria-pressed')).toBe('false')
  })

  it('stops an active preview before handling a keyboard reader command', async () => {
    await renderApp(true)
    await act(async () => {
      button('Preview voice').click()
      await Promise.resolve()
    })
    expect(speak).toHaveBeenCalledOnce()

    act(() => {
      document.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: ' ',
          code: 'Space',
          bubbles: true,
          cancelable: true,
        }),
      )
    })

    expect(cancel).toHaveBeenCalledOnce()
  })

  it('keeps a preset name when saving settings fails', async () => {
    mocks.updateSettings.mockRejectedValueOnce(new Error('storage failed'))
    await renderApp()
    const input = document.querySelector('input[type="text"]')
    if (!(input instanceof HTMLInputElement)) throw new Error('Missing preset input')

    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(
        input,
        'Keep this name',
      )
      input.dispatchEvent(new InputEvent('input', { bubbles: true }))
    })
    await act(async () => {
      button('Save preset').click()
      await Promise.resolve()
    })
    await vi.waitFor(() => expect(mocks.updateSettings).toHaveBeenCalledOnce())

    expect(input.value).toBe('Keep this name')
  })
})
