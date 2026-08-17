import type { ReaderDocument, ReaderState } from '@textreader/shared'
import type { MessageResponse, TextReaderMessage } from './protocol'

function isMessageResponse<T>(value: unknown): value is MessageResponse<T> {
  if (!value || typeof value !== 'object') return false
  const response = value as Record<string, unknown>
  if (response.ok === true) return true
  if (response.ok !== false || !response.error || typeof response.error !== 'object')
    return false
  const error = response.error as Record<string, unknown>
  return typeof error.code === 'string' && typeof error.message === 'string'
}

export async function sendRuntimeMessage<T = undefined>(
  message: TextReaderMessage,
): Promise<MessageResponse<T>> {
  try {
    const response: unknown = await chrome.runtime.sendMessage(message)
    if (response === undefined) return { ok: true }
    return isMessageResponse<T>(response)
      ? response
      : {
          ok: false,
          error: {
            code: 'UNKNOWN',
            message: 'The extension returned an invalid response.',
          },
        }
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
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    return tab
  } catch {
    return undefined
  }
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
    const response: unknown = await chrome.tabs.sendMessage(tabId, message)
    if (isMessageResponse<T>(response)) return response
    return {
      ok: false,
      error: { code: 'UNKNOWN', message: 'The page returned an invalid response.' },
    }
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
