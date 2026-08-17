import { describe, expect, it } from 'vitest'
import { isReaderTabUpdate, isReaderWindowActivation } from './use-reader-connection'

describe('reader tab event filtering', () => {
  it('accepts activation only from the Side Panel window', () => {
    expect(isReaderWindowActivation(4, 4)).toBe(true)
    expect(isReaderWindowActivation(4, 9)).toBe(false)
  })

  it('refreshes only meaningful updates for the connected tab', () => {
    expect(isReaderTabUpdate(12, 12, { status: 'complete' })).toBe(true)
    expect(isReaderTabUpdate(12, 12, { title: 'Renamed' })).toBe(false)
    expect(isReaderTabUpdate(12, 13, { url: 'https://example.com' })).toBe(false)
  })
})
