import type { ReaderDocument, ReaderState } from '@textreader/shared'
import type { MessageResponse, TextReaderMessage } from './protocol'

export async function sendRuntimeMessage<T = undefined>(
  message: TextReaderMessage,
): Promise<MessageResponse<T>> {
  try {
    const response: MessageResponse<T> | undefined =
      await chrome.runtime.sendMessage(message)
    return response ?? { ok: true }
  } catch (error) {
    return {
      ok: false,
      error: {
        code: 'UNKNOWN',
        message: error instanceof Error ? error.message : 'Extension messaging failed',
      },
    }
  }
}

export async function getActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  return tab
}

export async function sendToActiveTab<T = undefined>(
  message: TextReaderMessage,
): Promise<MessageResponse<T>> {
  const tab = await getActiveTab()
  if (tab?.id === undefined) {
    return {
      ok: false,
      error: { code: 'UNSUPPORTED_PAGE', message: 'No active webpage is available.' },
    }
  }

  return sendToTab<T>(tab.id, message)
}

export async function sendToTab<T = undefined>(
  tabId: number,
  message: TextReaderMessage,
): Promise<MessageResponse<T>> {
  try {
    return await chrome.tabs.sendMessage(tabId, message)
  } catch {
    return {
      ok: false,
      error: {
        code: 'UNSUPPORTED_PAGE',
        message: 'TextReader cannot run on this browser page.',
      },
    }
  }
}

export async function getActiveReaderState(): Promise<MessageResponse<ReaderState>> {
  return sendToActiveTab<ReaderState>({ type: 'GET_READER_STATE' })
}

export async function getActiveReaderDocument(): Promise<
  MessageResponse<ReaderDocument>
> {
  return sendToActiveTab<ReaderDocument>({ type: 'GET_READER_DOCUMENT' })
}

export async function getReaderState(
  tabId: number,
): Promise<MessageResponse<ReaderState>> {
  return sendToTab<ReaderState>(tabId, { type: 'GET_READER_STATE' })
}

export async function getReaderDocument(
  tabId: number,
): Promise<MessageResponse<ReaderDocument>> {
  return sendToTab<ReaderDocument>(tabId, { type: 'GET_READER_DOCUMENT' })
}
