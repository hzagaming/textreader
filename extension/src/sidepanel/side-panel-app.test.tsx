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

const chineseVoice = {
  name: 'Local Chinese',
  lang: 'zh-CN',
  voiceURI: 'voice-zh',
  default: false,
  localService: true,
} as SpeechSynthesisVoice

let root: Root | undefined
let speak: ReturnType<typeof vi.fn>
let cancel: ReturnType<typeof vi.fn>
let getVoices: ReturnType<typeof vi.fn>
let runtimeMessageListener: Parameters<typeof chrome.runtime.onMessage.addListener>[0]

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
  getVoices = vi.fn(() => [voice])
  vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance)
  vi.stubGlobal('speechSynthesis', {
    speaking: false,
    paused: false,
    pending: false,
    speak,
    cancel,
    pause: vi.fn(),
    resume: vi.fn(),
    getVoices,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })
  vi.stubGlobal('chrome', {
    runtime: {
      openOptionsPage: vi.fn(),
      onMessage: {
        addListener: vi.fn(
          (listener: Parameters<typeof chrome.runtime.onMessage.addListener>[0]) => {
            runtimeMessageListener = listener
          },
        ),
        removeListener: vi.fn(),
      },
    },
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
  it('shows one primary action set when no document is loaded', async () => {
    await renderApp(false, false)

    expect(
      [...document.querySelectorAll('button')].filter(
        (candidate) => candidate.textContent?.trim() === 'Read Article',
      ),
    ).toHaveLength(1)
    expect(
      [...document.querySelectorAll('button')].filter(
        (candidate) => candidate.textContent?.trim() === 'Read Page',
      ),
    ).toHaveLength(1)
  })

  it('keeps empty-state actions in the scroll flow on short panels', async () => {
    await renderApp(false, false)
    const emptyState = document.querySelector('[data-reader-empty]')

    expect(emptyState?.className).toContain('overflow-y-auto')
    expect(emptyState?.className).not.toContain('justify-center')
    expect(emptyState?.firstElementChild?.className).toContain('my-auto')
  })

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

    const introduction = speak.mock.calls[0]?.[0] as FakeUtterance | undefined
    expect(introduction).toMatchObject({
      text: 'Hi, this is TextReader.',
      rate: 1,
      pitch: 1,
    })

    act(() => {
      introduction?.onend?.call(
        introduction as unknown as SpeechSynthesisUtterance,
        {} as SpeechSynthesisEvent,
      )
    })

    expect(speak.mock.calls[1]?.[0]).toMatchObject({
      text: 'Ready to listen to this page together?',
      rate: 0.97,
      pitch: 1.08,
    })
  })

  it('previews a listed voice without changing the saved selection', async () => {
    getVoices.mockReturnValue([voice, chineseVoice])
    await renderApp()

    await act(async () => {
      button('Preview voice: Local Chinese (zh-CN)').click()
      await Promise.resolve()
    })

    expect(speak.mock.calls[0]?.[0]).toMatchObject({
      text: '你好，我是 TextReader。',
      voice: chineseVoice,
      lang: 'zh-CN',
    })
    expect(mocks.updateSettings).not.toHaveBeenCalled()
  })

  it('previews the interface language when automatic voice selection is used', async () => {
    getVoices.mockReturnValue([voice, chineseVoice])
    useReaderStore
      .getState()
      .setReader(createIdleReaderState({ ...DEFAULT_SETTINGS, uiLanguage: 'zh' }))
    await renderApp(false, false)
    act(() => button('音色与朗读设置').click())
    await vi.waitFor(() => expect(button('试听音色').disabled).toBe(false))

    await act(async () => {
      button('试听音色').click()
      await Promise.resolve()
    })

    expect(speak.mock.calls[0]?.[0]).toMatchObject({
      text: '你好，我是 TextReader。',
      voice: chineseVoice,
      lang: 'zh-CN',
    })
  })

  it('starts and can cancel a preview while the reader stop request is still pending', async () => {
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
    expect(speak).toHaveBeenCalledOnce()
    expect(button('Stop preview').getAttribute('aria-pressed')).toBe('true')
    act(() => button('Stop preview').click())
    await act(async () => {
      resolveStop?.({ ok: true })
      await Promise.resolve()
    })

    expect(cancel).toHaveBeenCalledOnce()
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

  it('stops an active preview when the global command requests it', async () => {
    await renderApp()
    await act(async () => {
      button('Preview voice').click()
      await Promise.resolve()
    })

    act(() => {
      runtimeMessageListener({ type: 'VOICE_PREVIEW_STOP' }, {}, vi.fn())
    })

    expect(cancel).toHaveBeenCalledOnce()
    expect(button('Preview voice').getAttribute('aria-pressed')).toBe('false')
  })

  it('stops an active preview when voice settings are closed', async () => {
    await renderApp()
    await act(async () => {
      button('Preview voice').click()
      await Promise.resolve()
    })

    act(() => button('Voice & reading settings').click())

    expect(cancel).toHaveBeenCalledOnce()
  })

  it('does not capture reader shortcuts while voice settings are open', async () => {
    await renderApp(true)
    mocks.sendToActiveTab.mockClear()

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

    expect(mocks.sendToActiveTab).not.toHaveBeenCalled()
  })

  it('stops an active preview before opening the Options page', async () => {
    await renderApp()
    await act(async () => {
      button('Preview voice').click()
      await Promise.resolve()
    })

    await act(async () => {
      button('Settings').click()
      await Promise.resolve()
    })

    expect(cancel).toHaveBeenCalledOnce()
  })

  it('names favorite actions for the exact voice and locale', async () => {
    getVoices.mockReturnValue([voice, chineseVoice])
    await renderApp()

    expect(button('Favorite voice: Local Chinese (zh-CN)').disabled).toBe(false)
  })

  it('does not cancel the speech engine after a preview finishes naturally', async () => {
    await renderApp()
    await act(async () => {
      button('Preview voice').click()
      await Promise.resolve()
    })
    const introduction = speak.mock.calls[0]?.[0] as FakeUtterance | undefined

    act(() => {
      introduction?.onend?.call(
        introduction as unknown as SpeechSynthesisUtterance,
        {} as SpeechSynthesisEvent,
      )
    })
    const question = speak.mock.calls[1]?.[0] as FakeUtterance | undefined
    act(() => {
      question?.onend?.call(
        question as unknown as SpeechSynthesisUtterance,
        {} as SpeechSynthesisEvent,
      )
    })

    expect(cancel).not.toHaveBeenCalled()
    expect(button('Preview voice').getAttribute('aria-pressed')).toBe('false')
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
