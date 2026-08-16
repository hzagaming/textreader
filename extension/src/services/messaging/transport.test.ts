import { afterEach, describe, expect, it, vi } from 'vitest'
import { getReaderDocument, getReaderState } from './transport'

afterEach(() => vi.unstubAllGlobals())

describe('reader transport', () => {
  it('loads state and document from one explicit tab', async () => {
    const sendMessage = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('chrome', { tabs: { sendMessage } })

    await Promise.all([getReaderState(42), getReaderDocument(42)])

    expect(sendMessage).toHaveBeenCalledWith(42, { type: 'GET_READER_STATE' })
    expect(sendMessage).toHaveBeenCalledWith(42, { type: 'GET_READER_DOCUMENT' })
  })
})
