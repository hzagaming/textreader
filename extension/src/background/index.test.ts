import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type RuntimeMessageListener = Parameters<typeof chrome.runtime.onMessage.addListener>[0]

let listener: RuntimeMessageListener
let connectListener: Parameters<typeof chrome.runtime.onConnect.addListener>[0]
let disconnectListener: () => void
let postMessage: ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.resetModules()
  postMessage = vi.fn()
  vi.stubGlobal('chrome', {
    commands: { onCommand: { addListener: vi.fn() } },
    contextMenus: {
      create: vi.fn(),
      onClicked: { addListener: vi.fn() },
      removeAll: vi.fn().mockResolvedValue(undefined),
    },
    runtime: {
      onConnect: {
        addListener: vi.fn(
          (nextListener: Parameters<typeof chrome.runtime.onConnect.addListener>[0]) => {
            connectListener = nextListener
          },
        ),
      },
      onInstalled: { addListener: vi.fn() },
      onMessage: {
        addListener: vi.fn((nextListener: RuntimeMessageListener) => {
          listener = nextListener
        }),
      },
      sendMessage: vi.fn().mockResolvedValue(undefined),
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
})
