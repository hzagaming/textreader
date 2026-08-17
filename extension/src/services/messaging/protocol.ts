import type { ReaderDocument, ReaderState } from '@textreader/shared'
import type { TextReaderErrorCode } from '@/types/errors'

export const READER_UPDATES_PORT = 'reader-updates'

export type TextReaderMessage =
  | { type: 'READ_TEXT'; payload: { text: string } }
  | { type: 'READ_CURRENT_SELECTION' }
  | { type: 'READ_PAGE'; payload: { mode: 'article' | 'page' } }
  | { type: 'CONTINUE_READING' }
  | { type: 'START_OVER' }
  | { type: 'READER_PAUSE' }
  | { type: 'READER_RESUME' }
  | { type: 'READER_STOP' }
  | { type: 'READER_NEXT' }
  | { type: 'READER_PREVIOUS' }
  | { type: 'READER_NEXT_PARAGRAPH' }
  | { type: 'READER_PREVIOUS_PARAGRAPH' }
  | { type: 'JUMP_TO_SENTENCE'; payload: { index: number } }
  | { type: 'JUMP_TO_PARAGRAPH'; payload: { index: number } }
  | { type: 'GET_READER_STATE' }
  | { type: 'GET_READER_DOCUMENT' }
  | { type: 'READER_STATE_CHANGED'; payload: ReaderState }
  | { type: 'READER_DOCUMENT_CHANGED'; payload: ReaderDocument }
  | { type: 'OPEN_SIDE_PANEL'; payload: { tabId: number } }

export type ReaderUpdateMessage = Extract<
  TextReaderMessage,
  { type: 'READER_STATE_CHANGED' | 'READER_DOCUMENT_CHANGED' }
>

export interface ReaderUpdateEnvelope {
  tabId: number
  message: ReaderUpdateMessage
}

export type MessageResponse<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: { code: TextReaderErrorCode; message: string } }

const PAYLOAD_FREE_TYPES = new Set<TextReaderMessage['type']>([
  'READ_CURRENT_SELECTION',
  'CONTINUE_READING',
  'START_OVER',
  'READER_PAUSE',
  'READER_RESUME',
  'READER_STOP',
  'READER_NEXT',
  'READER_PREVIOUS',
  'READER_NEXT_PARAGRAPH',
  'READER_PREVIOUS_PARAGRAPH',
  'GET_READER_STATE',
  'GET_READER_DOCUMENT',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasStringPayload(value: Record<string, unknown>, key: string): boolean {
  return isRecord(value.payload) && typeof value.payload[key] === 'string'
}

function hasNonNegativeIntegerPayload(
  value: Record<string, unknown>,
  key: string,
): boolean {
  return (
    isRecord(value.payload) &&
    Number.isInteger(value.payload[key]) &&
    Number(value.payload[key]) >= 0
  )
}

export function isTextReaderMessage(value: unknown): value is TextReaderMessage {
  if (!isRecord(value) || typeof value.type !== 'string') return false
  if (PAYLOAD_FREE_TYPES.has(value.type as TextReaderMessage['type'])) return true

  switch (value.type) {
    case 'READ_TEXT':
      return hasStringPayload(value, 'text')
    case 'READ_PAGE':
      return (
        isRecord(value.payload) &&
        (value.payload.mode === 'article' || value.payload.mode === 'page')
      )
    case 'READER_STATE_CHANGED':
      return (
        isRecord(value.payload) &&
        typeof value.payload.status === 'string' &&
        typeof value.payload.text === 'string'
      )
    case 'READER_DOCUMENT_CHANGED':
      return (
        isRecord(value.payload) &&
        typeof value.payload.id === 'string' &&
        Array.isArray(value.payload.paragraphs)
      )
    case 'JUMP_TO_SENTENCE':
    case 'JUMP_TO_PARAGRAPH':
      return hasNonNegativeIntegerPayload(value, 'index')
    case 'OPEN_SIDE_PANEL':
      return hasNonNegativeIntegerPayload(value, 'tabId')
    default:
      return false
  }
}

export function isReaderUpdateEnvelope(value: unknown): value is ReaderUpdateEnvelope {
  if (!isRecord(value) || !Number.isInteger(value.tabId) || Number(value.tabId) < 0)
    return false
  if (!isTextReaderMessage(value.message)) return false
  return (
    value.message.type === 'READER_STATE_CHANGED' ||
    value.message.type === 'READER_DOCUMENT_CHANGED'
  )
}

export function ok<T>(data?: T): MessageResponse<T> {
  return data === undefined ? { ok: true } : { ok: true, data }
}

export function failure(
  code: TextReaderErrorCode,
  message: string,
): MessageResponse<never> {
  return { ok: false, error: { code, message } }
}
