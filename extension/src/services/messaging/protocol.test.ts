import { describe, expect, it } from 'vitest'
import { isReaderUpdateEnvelope, isTextReaderMessage } from './protocol'

describe('isTextReaderMessage', () => {
  it('accepts known messages with valid payloads', () => {
    expect(isTextReaderMessage({ type: 'READER_PAUSE' })).toBe(true)
    expect(
      isTextReaderMessage({ type: 'READ_TEXT', payload: { text: 'Hello world' } }),
    ).toBe(true)
    expect(isTextReaderMessage({ type: 'READ_PAGE', payload: { mode: 'article' } })).toBe(
      true,
    )
    expect(isTextReaderMessage({ type: 'JUMP_TO_SENTENCE', payload: { index: 4 } })).toBe(
      true,
    )
  })

  it('rejects unknown and malformed messages', () => {
    expect(isTextReaderMessage({ type: 'DELETE_EVERYTHING' })).toBe(false)
    expect(isTextReaderMessage({ type: 'READ_TEXT', payload: { text: 42 } })).toBe(false)
    expect(
      isTextReaderMessage({ type: 'READ_PAGE', payload: { mode: 'everything' } }),
    ).toBe(false)
    expect(
      isTextReaderMessage({ type: 'JUMP_TO_SENTENCE', payload: { index: Number.NaN } }),
    ).toBe(false)
    expect(
      isTextReaderMessage({ type: 'JUMP_TO_SENTENCE', payload: { index: 1.5 } }),
    ).toBe(false)
    expect(
      isTextReaderMessage({ type: 'OPEN_SIDE_PANEL', payload: { tabId: Number.NaN } }),
    ).toBe(false)
    expect(
      isTextReaderMessage({ type: 'OPEN_SIDE_PANEL', payload: { tabId: 2.5 } }),
    ).toBe(false)
    expect(isTextReaderMessage(null)).toBe(false)
  })

  it('validates tab-scoped reader update envelopes', () => {
    expect(
      isReaderUpdateEnvelope({
        tabId: 7,
        message: {
          type: 'READER_STATE_CHANGED',
          payload: { status: 'playing', text: 'Current sentence' },
        },
      }),
    ).toBe(true)
    expect(
      isReaderUpdateEnvelope({
        tabId: 7,
        message: { type: 'READER_PAUSE' },
      }),
    ).toBe(false)
    expect(
      isReaderUpdateEnvelope({
        tabId: '7',
        message: {
          type: 'READER_STATE_CHANGED',
          payload: { status: 'playing', text: 'Current sentence' },
        },
      }),
    ).toBe(false)
  })
})
