import { describe, expect, it } from 'vitest'
import { LatestOperation } from './latest-operation'

describe('LatestOperation', () => {
  it('invalidates earlier reads and explicit cancellation', () => {
    const operations = new LatestOperation()
    const first = operations.begin()
    const second = operations.begin()

    expect(operations.isCurrent(first)).toBe(false)
    expect(operations.isCurrent(second)).toBe(true)

    operations.cancel()
    expect(operations.isCurrent(second)).toBe(false)
  })
})
