import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getActiveTab,
  getReaderDocument,
  getReaderState,
  sendToTab,
  updateSettings,
} from './transport'
import { DEFAULT_SETTINGS } from '@/services/settings/settings'

afterEach(() => vi.unstubAllGlobals())

describe('reader transport', () => {
  it('loads state and document from one explicit tab', async () => {
    const sendMessage = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('chrome', { tabs: { sendMessage } })

    await Promise.all([getReaderState(42), getReaderDocument(42)])

    expect(sendMessage).toHaveBeenCalledWith(42, { type: 'GET_READER_STATE' })
    expect(sendMessage).toHaveBeenCalledWith(42, { type: 'GET_READER_DOCUMENT' })
  })

  it('rejects an empty tab response instead of exposing an invalid success value', async () => {
    vi.stubGlobal('chrome', {
      tabs: { sendMessage: vi.fn().mockResolvedValue(undefined) },
    })

    await expect(sendToTab(42, { type: 'GET_READER_STATE' })).resolves.toMatchObject({
      ok: false,
    })
  })

  it('rejects a malformed failure response', async () => {
    vi.stubGlobal('chrome', {
      tabs: { sendMessage: vi.fn().mockResolvedValue({ ok: false }) },
    })

    await expect(sendToTab(42, { type: 'GET_READER_STATE' })).resolves.toMatchObject({
      ok: false,
      error: { code: 'UNKNOWN' },
    })
  })

  it('treats an unavailable tabs query as no active tab', async () => {
    vi.stubGlobal('chrome', {
      tabs: { query: vi.fn().mockRejectedValue(new Error('Context closed')) },
    })

    await expect(getActiveTab()).resolves.toBeUndefined()
  })

  it('routes settings writes through the extension runtime', async () => {
    const settings = { ...DEFAULT_SETTINGS, speed: 1.25 }
    const sendMessage = vi.fn().mockResolvedValue({ ok: true, data: settings })
    vi.stubGlobal('chrome', { runtime: { sendMessage } })

    await expect(updateSettings({ speed: 1.25 })).resolves.toEqual(settings)
    expect(sendMessage).toHaveBeenCalledWith({
      type: 'UPDATE_SETTINGS',
      payload: { patch: { speed: 1.25 } },
    })
  })
})
