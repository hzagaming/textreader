import { useEffect, useRef, useState } from 'react'
import { isReaderUpdateEnvelope } from '@/services/messaging/protocol'
import { subscribeToReaderUpdates } from '@/services/messaging/reader-updates-connection'
import {
  getActiveTab,
  getReaderDocument,
  getReaderState,
} from '@/services/messaging/transport'
import { settingsService } from '@/services/settings/settings'
import { useReaderStore } from '@/stores/reader-store'

export function useReaderConnection() {
  const setReader = useReaderStore((state) => state.setReader)
  const resetReader = useReaderStore((state) => state.resetReader)
  const patchReader = useReaderStore((state) => state.patchReader)
  const setDocument = useReaderStore((state) => state.setDocument)
  const [connectionError, setConnectionError] = useState('')
  const activeTabId = useRef<number | undefined>(undefined)

  useEffect(() => {
    let refreshVersion = 0
    const refresh = async (requestedTabId?: number) => {
      const version = ++refreshVersion
      const tabId = requestedTabId ?? (await getActiveTab())?.id
      if (version !== refreshVersion) return
      activeTabId.current = tabId
      resetReader()
      setDocument(null)
      if (tabId === undefined) {
        setConnectionError('No active webpage is available.')
        return
      }

      const [stateResponse, documentResponse] = await Promise.all([
        getReaderState(tabId),
        getReaderDocument(tabId),
      ])
      if (version !== refreshVersion || activeTabId.current !== tabId) return
      if (stateResponse.ok && stateResponse.data) {
        setReader(stateResponse.data)
        setConnectionError('')
      } else {
        setConnectionError(
          stateResponse.ok
            ? 'TextReader is not available on this page.'
            : stateResponse.error.message,
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
        setReader(update.message.payload)
      }
      if (update.message.type === 'READER_DOCUMENT_CHANGED') {
        setDocument(update.message.payload)
      }
    }
    const unsubscribeUpdates = subscribeToReaderUpdates(handleMessage)

    const handleActivated: Parameters<typeof chrome.tabs.onActivated.addListener>[0] = (
      activeInfo,
    ) => {
      void refresh(activeInfo.tabId)
    }
    const handleUpdated: Parameters<typeof chrome.tabs.onUpdated.addListener>[0] = (
      tabId,
      changeInfo,
      tab,
    ) => {
      if (tab.active && (changeInfo.status === 'complete' || changeInfo.url)) {
        void refresh(tabId)
      }
    }
    chrome.tabs.onActivated.addListener(handleActivated)
    chrome.tabs.onUpdated.addListener(handleUpdated)
    const unsubscribe = settingsService.subscribe((settings) => patchReader({ settings }))
    return () => {
      refreshVersion += 1
      unsubscribeUpdates()
      chrome.tabs.onActivated.removeListener(handleActivated)
      chrome.tabs.onUpdated.removeListener(handleUpdated)
      unsubscribe()
    }
  }, [patchReader, resetReader, setDocument, setReader])

  return connectionError
}
