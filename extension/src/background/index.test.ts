import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY } from '@/services/settings/settings'

type RuntimeMessageListener = Parameters<typeof chrome.runtime.onMessage.addListener>[0]

let listener: RuntimeMessageListener
let connectListener: Parameters<typeof chrome.runtime.onConnect.addListener>[0]
let disconnectListener: () => void
let postMessage: ReturnType<typeof vi.fn>
let commandListener: Parameters<typeof chrome.commands.onCommand.addListener>[0]
let installedListener: Parameters<typeof chrome.runtime.onInstalled.addListener>[0]
let startupListener: Parameters<typeof chrome.runtime.onStartup.addListener>[0]
let getStoredSettings: ReturnType<typeof vi.fn>
let storedSettings: Record<string, unknown>

beforeEach(() => {
  vi.resetModules()
  storedSettings = { ...DEFAULT_SETTINGS }
  getStoredSettings = vi.fn(() =>
    Promise.resolve({ [SETTINGS_STORAGE_KEY]: storedSettings }),
  )
  postMessage = vi.fn()
  vi.stubGlobal('chrome', {
    commands: {
      onCommand: {
        addListener: vi.fn(
          (nextListener: Parameters<typeof chrome.commands.onCommand.addListener>[0]) => {
            commandListener = nextListener
          },
        ),
      },
    },
    contextMenus: {
      create: vi.fn(),
      onClicked: { addListener: vi.fn() },
      removeAll: vi.fn().mockResolvedValue(undefined),
    },
    i18n: {
      getUILanguage: vi.fn(() => 'zh-CN'),
    },
    runtime: {
      onConnect: {
        addListener: vi.fn(
          (nextListener: Parameters<typeof chrome.runtime.onConnect.addListener>[0]) => {
            connectListener = nextListener
          },
        ),
      },
      onInstalled: {
        addListener: vi.fn(
          (
            nextListener: Parameters<typeof chrome.runtime.onInstalled.addListener>[0],
          ) => {
            installedListener = nextListener
          },
        ),
      },
      onStartup: {
        addListener: vi.fn(
          (nextListener: Parameters<typeof chrome.runtime.onStartup.addListener>[0]) => {
            startupListener = nextListener
          },
        ),
      },
      onMessage: {
        addListener: vi.fn((nextListener: RuntimeMessageListener) => {
          listener = nextListener
        }),
      },
      sendMessage: vi.fn().mockResolvedValue(undefined),
    },
    storage: {
      local: {
        get: getStoredSettings,
        set: vi.fn((changes: Record<string, unknown>) => {
          storedSettings = changes[SETTINGS_STORAGE_KEY] as Record<string, unknown>
          return Promise.resolve()
        }),
      },
    },
    sidePanel: { open: vi.fn().mockResolvedValue(undefined) },
    tabs: {
      query: vi.fn().mockResolvedValue([]),
      sendMessage: vi.fn().mockResolvedValue(undefined),
    },
  })
})

afterEach(() => vi.unstubAllGlobals())

describe('background message relay', () => {
  it('creates English context menus for a new installation on a Chinese browser', async () => {
    storedSettings = {}
    await import('./service-worker')

    installedListener({ reason: 'install' })

    await vi.waitFor(() => expect(chrome.contextMenus.create).toHaveBeenCalledTimes(3))
    expect(chrome.contextMenus.create).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'textreader-root', title: 'Read with TextReader' }),
    )
    expect(chrome.contextMenus.create).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'textreader-read-selection',
        title: 'Read selected text',
      }),
    )
    expect(chrome.contextMenus.create).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'textreader-open', title: 'Open TextReader' }),
    )
  })

  it('falls back to English menus when new-install storage is unavailable', async () => {
    getStoredSettings.mockRejectedValueOnce(new Error('storage unavailable'))
    await import('./service-worker')

    installedListener({ reason: 'install' })

    await vi.waitFor(() => expect(chrome.contextMenus.create).toHaveBeenCalledTimes(3))
    expect(chrome.contextMenus.create).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'textreader-root', title: 'Read with TextReader' }),
    )
  })

  it('rebuilds context menus in the explicitly selected language', async () => {
    await import('./service-worker')
    const response = new Promise((resolve) => {
      listener(
        { type: 'UPDATE_SETTINGS', payload: { patch: { uiLanguage: 'ja' } } },
        {},
        resolve,
      )
    })

    await expect(response).resolves.toEqual(expect.objectContaining({ ok: true }))
    expect(chrome.contextMenus.create).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'textreader-root',
        title: 'TextReader で読み上げる',
      }),
    )
    expect(chrome.contextMenus.create).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'textreader-read-selection',
        title: '選択したテキストを読む',
      }),
    )
    expect(chrome.contextMenus.create).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'textreader-open', title: 'TextReader を開く' }),
    )
  })

  it('refreshes system-language context menus when the browser starts', async () => {
    storedSettings = { ...DEFAULT_SETTINGS, uiLanguage: 'auto' }
    await import('./service-worker')

    startupListener()

    await vi.waitFor(() => expect(chrome.contextMenus.create).toHaveBeenCalledTimes(3))
    expect(chrome.contextMenus.create).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'textreader-root',
        title: '使用 TextReader 朗读',
      }),
    )
  })

  it('relays reader updates from content scripts to extension views', async () => {
    await import('./service-worker')
    connectListener({
      name: 'reader-updates',
      onDisconnect: {
        addListener: vi.fn((nextListener: () => void) => {
          disconnectListener = nextListener
        }),
      },
      postMessage,
    } as unknown as chrome.runtime.Port)
    const stateMessage = {
      type: 'READER_STATE_CHANGED',
      payload: { status: 'playing', text: 'Current sentence' },
    }
    const documentMessage = {
      type: 'READER_DOCUMENT_CHANGED',
      payload: { id: 'document-1', paragraphs: [] },
    }
    const sender = { tab: { id: 42 } } as chrome.runtime.MessageSender

    listener(stateMessage, sender, vi.fn())
    listener(documentMessage, sender, vi.fn())

    expect(postMessage).toHaveBeenNthCalledWith(1, {
      tabId: 42,
      message: stateMessage,
    })
    expect(postMessage).toHaveBeenNthCalledWith(2, {
      tabId: 42,
      message: documentMessage,
    })

    disconnectListener()
    listener(stateMessage, sender, vi.fn())
    expect(postMessage).toHaveBeenCalledTimes(2)
  })

  it('does not relay extension-originated updates', async () => {
    await import('./service-worker')
    listener(
      {
        type: 'READER_STATE_CHANGED',
        payload: { status: 'paused', text: 'Current sentence' },
      },
      {},
      vi.fn(),
    )

    expect(postMessage).not.toHaveBeenCalled()
  })

  it('serializes settings patches from every extension view in the background', async () => {
    await import('./service-worker')
    const dispatch = (patch: Record<string, unknown>) =>
      new Promise((resolve) => {
        listener({ type: 'UPDATE_SETTINGS', payload: { patch } }, {}, resolve)
      })

    const responses = await Promise.all([
      dispatch({ speed: 1.4 }),
      dispatch({ theme: 'dark' }),
    ])

    expect(responses).toEqual([
      expect.objectContaining({ ok: true }),
      expect.objectContaining({ ok: true }),
    ])
    expect(storedSettings).toMatchObject({ speed: 1.4, theme: 'dark' })
  })

  it('stops Side Panel voice previews with the global stop command', async () => {
    await import('./service-worker')

    commandListener('stop-reading', { id: 42 } as chrome.tabs.Tab)
    await Promise.resolve()

    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(42, {
      type: 'READER_STOP',
    })
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      type: 'VOICE_PREVIEW_STOP',
    })
  })

  it('stops a Side Panel preview even when the command has no active tab', async () => {
    await import('./service-worker')

    commandListener('stop-reading')
    await Promise.resolve()

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      type: 'VOICE_PREVIEW_STOP',
    })
    expect(chrome.tabs.sendMessage).not.toHaveBeenCalled()
  })
})
