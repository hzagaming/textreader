// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MessageResponse } from '@/services/messaging/protocol'
import { DEFAULT_SETTINGS } from '@/services/settings/settings'
import type { SettingsPatch } from '@/services/settings/settings-update-queue'
import { voiceIdentity } from '@/services/tts/voice-catalog'
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
  updateSettings: mocks.updateSettings,
}))

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
let tabActivatedListener: Parameters<typeof chrome.tabs.onActivated.addListener>[0]
let tabUpdatedListener: Parameters<typeof chrome.tabs.onUpdated.addListener>[0]

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
      onActivated: {
        addListener: vi.fn(
          (listener: Parameters<typeof chrome.tabs.onActivated.addListener>[0]) => {
            tabActivatedListener = listener
          },
        ),
        removeListener: vi.fn(),
      },
      onUpdated: {
        addListener: vi.fn(
          (listener: Parameters<typeof chrome.tabs.onUpdated.addListener>[0]) => {
            tabUpdatedListener = listener
          },
        ),
        removeListener: vi.fn(),
      },
    },
  })
  mocks.sendToActiveTab.mockResolvedValue({ ok: true })
  mocks.updateSettings.mockResolvedValue(DEFAULT_SETTINGS)
  useReaderStore.getState().setReader(createIdleReaderState(DEFAULT_SETTINGS))
  useReaderStore.getState().setDocument(null)
})

afterEach(() => {
  vi.useRealTimers()
  if (root) act(() => root?.unmount())
  root = undefined
  document.body.replaceChildren()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

describe('SidePanel voice preview', () => {
  it('ignores a stale page-title lookup after a newer tab activation', async () => {
    await renderApp(false, false)
    let resolveOld:
      ((tabs: Array<{ id: number; windowId: number; title: string }>) => void) | undefined
    let resolveNew:
      ((tabs: Array<{ id: number; windowId: number; title: string }>) => void) | undefined
    const query = chrome.tabs.query as unknown as ReturnType<typeof vi.fn>
    query
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveOld = resolve
        }),
      )
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveNew = resolve
        }),
      )

    act(() => {
      tabActivatedListener({ tabId: 2, windowId: 1 })
      tabActivatedListener({ tabId: 3, windowId: 1 })
    })
    await act(async () => {
      resolveNew?.([{ id: 3, windowId: 1, title: 'Newest page' }])
      await Promise.resolve()
    })
    await act(async () => {
      resolveOld?.([{ id: 2, windowId: 1, title: 'Stale page' }])
      await Promise.resolve()
    })

    expect(document.querySelector('header > span')?.textContent).toBe('Newest page')
  })

  it('does not accept old-tab titles when the new title lookup fails', async () => {
    await renderApp(false, false)
    const query = chrome.tabs.query as unknown as ReturnType<typeof vi.fn>
    query.mockRejectedValueOnce(new Error('query failed'))

    await act(async () => {
      tabActivatedListener({ tabId: 2, windowId: 1 })
      await Promise.resolve()
    })
    await vi.waitFor(() =>
      expect(document.querySelector('header > span')?.textContent).toBe('Current page'),
    )

    act(() => tabUpdatedListener(1, { title: 'Old tab title' }, {} as chrome.tabs.Tab))
    expect(document.querySelector('header > span')?.textContent).toBe('Current page')

    act(() => tabUpdatedListener(2, { title: 'New tab title' }, {} as chrome.tabs.Tab))
    expect(document.querySelector('header > span')?.textContent).toBe('New tab title')
  })

  it('uses the localized fallback when the active tab title becomes empty', async () => {
    await renderApp(false, false)

    act(() => tabUpdatedListener(1, { title: '' }, {} as chrome.tabs.Tab))

    expect(document.querySelector('header > span')?.textContent).toBe('Current page')
  })

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

  it('keeps compact footer reading actions fully named', async () => {
    await renderApp(true, false)

    const readArticle = button('Read Article')
    const readPage = button('Read Page')
    expect(readArticle.getAttribute('aria-label')).toBe('Read Article')
    expect(readArticle.getAttribute('title')).toBe('Read Article')
    expect(readPage.getAttribute('aria-label')).toBe('Read Page')
    expect(readPage.getAttribute('title')).toBe('Read Page')
    expect(readArticle.querySelector('span')?.className).toContain('max-[330px]:sr-only')
    expect(readPage.querySelector('span')?.className).toContain('max-[330px]:sr-only')
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
    expect(settingsButton.nextElementSibling?.className).toContain('tr-panel-reveal')
  })

  it('gives voice library text fields persistent accessible names', async () => {
    await renderApp()

    expect(
      document.querySelector('input[type="search"]')?.getAttribute('aria-label'),
    ).toBe('Search voices…')
    expect(document.querySelector('input[type="text"]')?.getAttribute('aria-label')).toBe(
      'Preset name',
    )
  })

  it('keeps sentence text in the accessible jump label', async () => {
    useReaderStore.getState().setReader({
      ...createIdleReaderState(DEFAULT_SETTINGS),
      status: 'stopped',
      text: 'Readable sentence.',
      sentenceCount: 1,
    })
    useReaderStore.getState().setDocument({
      id: 'document-accessibility',
      url: 'https://example.com',
      title: 'Accessible document',
      paragraphs: [
        {
          id: 'paragraph-1',
          text: 'Readable sentence.',
          index: 0,
          sentences: [
            {
              id: 'sentence-1',
              text: 'Readable sentence.',
              index: 0,
              paragraphId: 'paragraph-1',
            },
          ],
        },
      ],
      plainText: 'Readable sentence.',
      createdAt: 1,
    })

    await renderApp(false, false)

    expect(document.querySelector('article button')?.getAttribute('aria-label')).toBe(
      'Readable sentence. · Jump to sentence 1',
    )
  })

  it('renders sentence spacing outside the inline jump controls', async () => {
    useReaderStore.getState().setReader({
      ...createIdleReaderState(DEFAULT_SETTINGS),
      status: 'stopped',
      text: 'First sentence.',
      sentenceCount: 2,
    })
    useReaderStore.getState().setDocument({
      id: 'document-spacing',
      url: 'https://example.com',
      title: 'Readable document',
      paragraphs: [
        {
          id: 'paragraph-1',
          text: 'First sentence. Second sentence.',
          index: 0,
          sentences: [
            {
              id: 'sentence-1',
              text: 'First sentence.',
              index: 0,
              paragraphId: 'paragraph-1',
            },
            {
              id: 'sentence-2',
              text: 'Second sentence.',
              index: 1,
              paragraphId: 'paragraph-1',
            },
          ],
        },
      ],
      plainText: 'First sentence. Second sentence.',
      createdAt: 1,
    })

    await renderApp(false, false)

    const firstSentence = document.querySelector('article button')
    expect(firstSentence?.nextSibling?.nodeType).toBe(Node.TEXT_NODE)
    expect(firstSentence?.nextSibling?.textContent).toBe(' ')
  })

  it('shows dedicated visual feedback while playback is starting', async () => {
    useReaderStore.getState().setReader({
      ...createIdleReaderState(DEFAULT_SETTINGS),
      status: 'loading',
    })

    await renderApp(true, false)

    const primary = button('Starting playback')
    expect(primary.dataset.state).toBe('loading')
    expect(primary.querySelector('[data-reader-spinner]')).not.toBeNull()
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

  it('tracks a preview by voice and locale when voice IDs collide', async () => {
    const duplicateLocaleVoice = {
      ...voice,
      lang: 'zh-CN',
    } as SpeechSynthesisVoice
    getVoices.mockReturnValue([voice, duplicateLocaleVoice])
    await renderApp()

    await act(async () => {
      button('Preview voice: Local English (zh-CN)').click()
      await Promise.resolve()
    })

    expect(
      button('Preview voice: Local English (en-US)').getAttribute('aria-pressed'),
    ).toBe('false')
    expect(
      button('Stop preview: Local English (zh-CN)').getAttribute('aria-pressed'),
    ).toBe('true')
  })

  it('persists the exact locale when selecting voices with colliding IDs', async () => {
    const duplicateLocaleVoice = {
      ...voice,
      lang: 'zh-CN',
    } as SpeechSynthesisVoice
    getVoices.mockReturnValue([voice, duplicateLocaleVoice])
    await renderApp()
    const row = button('Preview voice: Local English (zh-CN)').closest(
      '[role="listitem"]',
    )
    const select = row?.querySelector('button')
    if (!(select instanceof HTMLButtonElement))
      throw new Error('Missing duplicate locale voice selector')

    await act(async () => {
      select.click()
      await Promise.resolve()
    })

    expect(mocks.updateSettings).toHaveBeenCalledWith({
      voiceId: voiceIdentity(duplicateLocaleVoice),
      recentVoiceIds: [voiceIdentity(duplicateLocaleVoice)],
    })
  })

  it('distinguishes regional voices in per-language mapping', async () => {
    const traditional = {
      ...chineseVoice,
      name: 'Shared Chinese',
      lang: 'zh-TW',
      voiceURI: 'shared',
    } as SpeechSynthesisVoice
    const simplified = {
      ...traditional,
      lang: 'zh-CN',
    } as SpeechSynthesisVoice
    getVoices.mockReturnValue([traditional, simplified])
    await renderApp()
    const label = [...document.querySelectorAll('fieldset label')].find(
      (candidate) => candidate.querySelector('span')?.textContent === 'Chinese',
    )
    const select = label?.querySelector('select')
    if (!(select instanceof HTMLSelectElement))
      throw new Error('Missing Chinese voice mapping')

    expect([...select.options].map((option) => option.textContent)).toEqual([
      'Automatic system voice',
      'Shared Chinese (zh-TW)',
      'Shared Chinese (zh-CN)',
    ])

    await act(async () => {
      select.value = voiceIdentity(simplified)
      select.dispatchEvent(new Event('change', { bubbles: true }))
      await Promise.resolve()
    })

    expect(mocks.updateSettings).toHaveBeenCalledWith({
      voiceByLanguage: {
        ...DEFAULT_SETTINGS.voiceByLanguage,
        zh: voiceIdentity(simplified),
      },
      recentVoiceIds: [voiceIdentity(simplified)],
    })
  })

  it('shows when a saved per-language voice is unavailable', async () => {
    useReaderStore.getState().setReader(
      createIdleReaderState({
        ...DEFAULT_SETTINGS,
        voiceByLanguage: {
          ...DEFAULT_SETTINGS.voiceByLanguage,
          zh: 'missing-chinese-voice',
        },
      }),
    )
    await renderApp()
    const chineseLabel = [...document.querySelectorAll('fieldset label')].find(
      (candidate) => candidate.querySelector('span')?.textContent === 'Chinese',
    )
    const select = chineseLabel?.querySelector('select')
    if (!(select instanceof HTMLSelectElement))
      throw new Error('Missing Chinese voice mapping')

    expect(select.value).toBe('missing-chinese-voice')
    expect(select.selectedOptions[0]?.textContent).toBe('Unavailable saved voice')
  })

  it('keeps rapid voice mappings for different languages', async () => {
    getVoices.mockReturnValue([voice, chineseVoice])
    mocks.updateSettings.mockImplementation((patch: SettingsPatch) =>
      Promise.resolve({ ...DEFAULT_SETTINGS, ...patch }),
    )
    await renderApp()
    const selects = [...document.querySelectorAll('fieldset label')].map((label) => ({
      language: label.querySelector('span')?.textContent,
      select: label.querySelector('select'),
    }))
    const english = selects.find(({ language }) => language === 'English')?.select
    const chinese = selects.find(({ language }) => language === 'Chinese')?.select
    if (!(english instanceof HTMLSelectElement))
      throw new Error('Missing English voice mapping')
    if (!(chinese instanceof HTMLSelectElement))
      throw new Error('Missing Chinese voice mapping')

    act(() => {
      english.value = voiceIdentity(voice)
      english.dispatchEvent(new Event('change', { bubbles: true }))
      chinese.value = voiceIdentity(chineseVoice)
      chinese.dispatchEvent(new Event('change', { bubbles: true }))
    })

    await act(async () => {
      await vi.waitFor(() => expect(mocks.updateSettings).toHaveBeenCalledTimes(2))
    })
    expect(mocks.updateSettings).toHaveBeenNthCalledWith(2, {
      voiceByLanguage: {
        ...DEFAULT_SETTINGS.voiceByLanguage,
        en: voiceIdentity(voice),
        zh: voiceIdentity(chineseVoice),
      },
      recentVoiceIds: [voiceIdentity(chineseVoice), voiceIdentity(voice)],
    })
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

  it('recovers when a started voice preview never finishes', async () => {
    await renderApp()
    vi.useFakeTimers()
    await act(async () => {
      button('Preview voice').click()
      await Promise.resolve()
    })
    const introduction = speak.mock.calls[0]?.[0] as FakeUtterance | undefined

    act(() => {
      introduction?.onstart?.call(
        introduction as unknown as SpeechSynthesisUtterance,
        {} as SpeechSynthesisEvent,
      )
    })
    await act(async () => vi.advanceTimersByTimeAsync(45_000))

    expect(cancel).toHaveBeenCalledOnce()
    expect(document.querySelector('[role="alert"]')?.textContent).toContain(
      'could not play',
    )
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

  it('keeps both voices when favorites are changed rapidly', async () => {
    getVoices.mockReturnValue([voice, chineseVoice])
    mocks.updateSettings.mockImplementation((patch: SettingsPatch) =>
      Promise.resolve({ ...DEFAULT_SETTINGS, ...patch }),
    )
    await renderApp()

    act(() => {
      button('Favorite voice: Local English (en-US)').click()
      button('Favorite voice: Local Chinese (zh-CN)').click()
    })

    await act(async () => {
      await vi.waitFor(() => expect(mocks.updateSettings).toHaveBeenCalledTimes(2))
    })
    expect(mocks.updateSettings).toHaveBeenNthCalledWith(2, {
      favoriteVoiceIds: [voiceIdentity(chineseVoice), voiceIdentity(voice)],
    })
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

  it('requires confirmation before permanently deleting a voice preset', async () => {
    const confirm = vi.fn(() => false)
    vi.stubGlobal('confirm', confirm)
    useReaderStore.getState().setReader(
      createIdleReaderState({
        ...DEFAULT_SETTINGS,
        voicePresets: [
          {
            id: 'calm-preset',
            name: 'Calm preset',
            voiceId: '',
            readingLanguage: 'auto',
            speed: 1,
            pitch: 0,
            volume: 1,
            naturalExpression: true,
            createdAt: 1,
          },
        ],
      }),
    )
    await renderApp()

    act(() => button('Delete Calm preset').click())

    expect(confirm).toHaveBeenCalledWith(
      'Delete the “Calm preset” voice preset? This cannot be undone.',
    )
    expect(mocks.updateSettings).not.toHaveBeenCalled()

    confirm.mockReturnValue(true)
    await act(async () => {
      button('Delete Calm preset').click()
      await Promise.resolve()
    })

    expect(mocks.updateSettings).toHaveBeenCalledWith({ voicePresets: [] })
  })
})
