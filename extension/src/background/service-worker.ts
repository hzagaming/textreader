import type { ReaderSettings } from '@textreader/shared'
import { createTranslator } from '@/services/i18n/i18n'
import {
  READER_UPDATES_PORT,
  failure,
  isTextReaderMessage,
  ok,
  type ReaderUpdateMessage,
} from '@/services/messaging/protocol'
import { DEFAULT_SETTINGS, settingsService } from '@/services/settings/settings'

const MENU_ROOT = 'textreader-root'
const MENU_READ_SELECTION = 'textreader-read-selection'
const MENU_OPEN = 'textreader-open'
const readerPorts = new Set<chrome.runtime.Port>()
let contextMenuQueue: Promise<void> = Promise.resolve()

function updateContextMenus(settings?: ReaderSettings): Promise<void> {
  const operation = contextMenuQueue.then(async () => {
    const currentSettings = settings ?? (await settingsService.get())
    const t = createTranslator(currentSettings.uiLanguage)
    await chrome.contextMenus.removeAll()
    chrome.contextMenus.create({
      id: MENU_ROOT,
      title: t('contextMenuRoot'),
      contexts: ['all'],
    })
    chrome.contextMenus.create({
      id: MENU_READ_SELECTION,
      parentId: MENU_ROOT,
      title: t('contextMenuSelection'),
      contexts: ['selection'],
    })
    chrome.contextMenus.create({
      id: MENU_OPEN,
      parentId: MENU_ROOT,
      title: t('contextMenuOpen'),
      contexts: ['all'],
    })
  })
  contextMenuQueue = operation.catch(() => undefined)
  return operation
}

function relayReaderUpdate(tabId: number, message: ReaderUpdateMessage): void {
  for (const port of readerPorts) {
    try {
      port.postMessage({ tabId, message })
    } catch {
      readerPorts.delete(port)
    }
  }
}

async function activeTab(): Promise<chrome.tabs.Tab | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  return tab
}

async function openSidePanel(tab?: chrome.tabs.Tab): Promise<void> {
  const target = tab ?? (await activeTab())
  if (target?.id === undefined) throw new Error('No active tab is available.')
  await chrome.sidePanel.open({ tabId: target.id })
}

async function sendToTab(tab: chrome.tabs.Tab, message: unknown): Promise<void> {
  if (tab.id === undefined) throw new Error('The target tab is unavailable.')
  await chrome.tabs.sendMessage(tab.id, message)
}

const refreshContextMenus = () => {
  void updateContextMenus().catch(() => undefined)
}

chrome.runtime.onInstalled.addListener((details) => {
  void updateContextMenus().catch(() => {
    if (details.reason === 'install')
      return updateContextMenus(DEFAULT_SETTINGS).catch(() => undefined)
  })
})
chrome.runtime.onStartup.addListener(refreshContextMenus)

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab) return

  if (info.menuItemId === MENU_READ_SELECTION && info.selectionText) {
    void sendToTab(tab, { type: 'READ_TEXT', payload: { text: info.selectionText } })
      .then(() => openSidePanel(tab))
      .catch(() => undefined)
  }

  if (info.menuItemId === MENU_OPEN) {
    void openSidePanel(tab).catch(() => undefined)
  }
})

chrome.commands.onCommand.addListener((command, tab) => {
  if (command === 'open-or-read') {
    void chrome.runtime.sendMessage({ type: 'VOICE_PREVIEW_STOP' }).catch(() => undefined)
    const target = tab ?? undefined
    if (target)
      void sendToTab(target, { type: 'READ_CURRENT_SELECTION' }).catch(() => undefined)
    void openSidePanel(target).catch(() => undefined)
  }

  if (command === 'stop-reading') {
    void chrome.runtime.sendMessage({ type: 'VOICE_PREVIEW_STOP' }).catch(() => undefined)
    if (tab) void sendToTab(tab, { type: 'READER_STOP' }).catch(() => undefined)
  }
})

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== READER_UPDATES_PORT) return
  readerPorts.add(port)
  port.onDisconnect.addListener(() => readerPorts.delete(port))
})

chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
  if (!isTextReaderMessage(message)) return false

  if (
    sender.tab?.id !== undefined &&
    (message.type === 'READER_STATE_CHANGED' ||
      message.type === 'READER_DOCUMENT_CHANGED')
  ) {
    relayReaderUpdate(sender.tab.id, message)
    return false
  }

  if (message.type === 'UPDATE_SETTINGS') {
    void settingsService
      .update(message.payload.patch)
      .then(async (settings) => {
        if (message.payload.patch.uiLanguage !== undefined)
          await updateContextMenus(settings).catch(() => undefined)
        sendResponse(ok(settings))
      })
      .catch((error: unknown) => {
        sendResponse(
          failure(
            'UNKNOWN',
            error instanceof Error ? error.message : 'Unable to save settings.',
          ),
        )
      })
    return true
  }

  if (message.type !== 'OPEN_SIDE_PANEL') return false

  void chrome.sidePanel
    .open({ tabId: message.payload.tabId })
    .then(() => sendResponse(ok()))
    .catch((error: unknown) => {
      sendResponse(
        failure(
          'PERMISSION_ERROR',
          error instanceof Error ? error.message : 'Unable to open TextReader.',
        ),
      )
    })
  return true
})
