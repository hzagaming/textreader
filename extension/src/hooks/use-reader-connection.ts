import { useEffect, useRef, useState } from 'react'
import type { ReaderSettings } from '@textreader/shared'
import { isReaderUpdateEnvelope } from '@/services/messaging/protocol'
import { subscribeToReaderUpdates } from '@/services/messaging/reader-updates-connection'
import {
  getActiveTab,
  getReaderDocument,
  getReaderState,
} from '@/services/messaging/transport'
import { settingsService } from '@/services/settings/settings'
import type { Translator } from '@/services/i18n/i18n'
import { useReaderStore } from '@/stores/reader-store'

type TabChangeInfo = Parameters<
  Parameters<typeof chrome.tabs.onUpdated.addListener>[0]
>[1]

export function isReaderWindowActivation(
  activeWindowId: number | undefined,
  eventWindowId: number,
): boolean {
  return activeWindowId === undefined || activeWindowId === eventWindowId
}

export function isReaderTabUpdate(
  activeTabId: number | undefined,
  eventTabId: number,
  changeInfo: TabChangeInfo,
): boolean {
  return (
    activeTabId === eventTabId &&
    (changeInfo.status === 'complete' || typeof changeInfo.url === 'string')
  )
}

export function useReaderConnection(t: Translator) {
  const setReader = useReaderStore((state) => state.setReader)
  const resetReader = useReaderStore((state) => state.resetReader)
  const patchReader = useReaderStore((state) => state.patchReader)
  const setDocument = useReaderStore((state) => state.setDocument)
  const [connectionError, setConnectionError] = useState('')
  const activeTabId = useRef<number | undefined>(undefined)
  const activeWindowId = useRef<number | undefined>(undefined)
  const localSettings = useRef<ReaderSettings | undefined>(undefined)

  useEffect(() => {
    let refreshVersion = 0
    let settingsVersion = 0
    const unsubscribeSettings = settingsService.subscribe((settings) => {
      settingsVersion += 1
      localSettings.current = settings
      patchReader({ settings })
    })
    const initialSettingsVersion = settingsVersion
    void settingsService
      .get()
      .then((settings) => {
        if (settingsVersion !== initialSettingsVersion) return
        localSettings.current = settings
        patchReader({ settings })
      })
      .catch(() => undefined)
    const refresh = async (requestedTabId?: number) => {
      const version = ++refreshVersion
      const activeTab = requestedTabId === undefined ? await getActiveTab() : undefined
      const tabId = requestedTabId ?? activeTab?.id
      if (version !== refreshVersion) return
      if (activeTab) activeWindowId.current = activeTab.windowId
      activeTabId.current = tabId
      resetReader()
      setDocument(null)
      if (tabId === undefined) {
        setConnectionError(t('noActivePage'))
        return
      }

      const [stateResponse, documentResponse] = await Promise.all([
        getReaderState(tabId),
        getReaderDocument(tabId),
      ])
      if (version !== refreshVersion || activeTabId.current !== tabId) return
      if (stateResponse.ok && stateResponse.data) {
        setReader(
          localSettings.current
            ? { ...stateResponse.data, settings: localSettings.current }
            : stateResponse.data,
        )
        setConnectionError('')
      } else {
        setConnectionError(
          stateResponse.ok ? t('unavailableOnPage') : t('unableToContactPage'),
        )
      }
      if (documentResponse.ok && documentResponse.data) {
        setDocument(documentResponse.data)
      } else {
        setDocument(null)
      }
    }
    void refresh()

    const handleMessage = (update: unknown) => {
      if (!isReaderUpdateEnvelope(update) || update.tabId !== activeTabId.current) return
      if (update.message.type === 'READER_STATE_CHANGED') {
        setReader(
          localSettings.current
            ? { ...update.message.payload, settings: localSettings.current }
            : update.message.payload,
        )
      }
      if (update.message.type === 'READER_DOCUMENT_CHANGED') {
        setDocument(update.message.payload)
      }
    }
    const unsubscribeUpdates = subscribeToReaderUpdates(handleMessage, 250, () => {
      void refresh(activeTabId.current)
    })

    const handleActivated: Parameters<typeof chrome.tabs.onActivated.addListener>[0] = (
      activeInfo,
    ) => {
      if (!isReaderWindowActivation(activeWindowId.current, activeInfo.windowId)) return
      activeWindowId.current = activeInfo.windowId
      void refresh(activeInfo.tabId)
    }
    const handleUpdated: Parameters<typeof chrome.tabs.onUpdated.addListener>[0] = (
      tabId,
      changeInfo,
    ) => {
      if (isReaderTabUpdate(activeTabId.current, tabId, changeInfo)) void refresh(tabId)
    }
    chrome.tabs.onActivated.addListener(handleActivated)
    chrome.tabs.onUpdated.addListener(handleUpdated)
    return () => {
      refreshVersion += 1
      settingsVersion += 1
      unsubscribeUpdates()
      chrome.tabs.onActivated.removeListener(handleActivated)
      chrome.tabs.onUpdated.removeListener(handleUpdated)
      unsubscribeSettings()
    }
  }, [patchReader, resetReader, setDocument, setReader, t])

  return connectionError
}
