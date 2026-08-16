import { afterEach, describe, expect, it, vi } from 'vitest'
import { ReadingProgressService, normalizeReadingProgress } from './reading-progress'

afterEach(() => vi.unstubAllGlobals())

describe('normalizeReadingProgress', () => {
  it('validates and clamps persisted progress', () => {
    expect(
      normalizeReadingProgress({
        url: 'https://example.com',
        documentId: 'doc-1',
        source: 'article',
        sentenceIndex: 8.8,
        progress: 2,
        updatedAt: 42,
      }),
    ).toEqual({
      url: 'https://example.com',
      documentId: 'doc-1',
      source: 'article',
      sentenceIndex: 8,
      progress: 1,
      updatedAt: 42,
    })
  })

  it('rejects malformed progress', () => {
    expect(normalizeReadingProgress({ url: 'https://example.com' })).toBeUndefined()
    expect(
      normalizeReadingProgress({
        url: 'https://example.com',
        documentId: 'doc-1',
        source: 'article',
        sentenceIndex: Number.NaN,
        progress: Number.POSITIVE_INFINITY,
        updatedAt: 42,
      }),
    ).toBeUndefined()
    expect(normalizeReadingProgress(null)).toBeUndefined()
  })

  it('preserves progress saved concurrently by isolated tab contexts', async () => {
    const stored: Record<string, unknown> = {}
    vi.stubGlobal('chrome', {
      storage: {
        local: {
          get: vi.fn(async (key: string | null) => {
            const snapshot = { ...stored }
            await Promise.resolve()
            return key === null ? snapshot : { [key]: snapshot[key] }
          }),
          set: vi.fn(async (changes: Record<string, unknown>) => {
            await Promise.resolve()
            Object.assign(stored, changes)
          }),
          remove: vi.fn((keys: string | string[]) => {
            for (const key of Array.isArray(keys) ? keys : [keys]) delete stored[key]
          }),
        },
      },
    })
    const firstService = new ReadingProgressService()
    const secondService = new ReadingProgressService()
    const first = {
      url: 'https://example.com/first',
      documentId: 'first',
      source: 'article' as const,
      sentenceIndex: 3,
      progress: 0.3,
      updatedAt: 30,
    }
    const second = {
      url: 'https://example.com/second',
      documentId: 'second',
      source: 'page' as const,
      sentenceIndex: 6,
      progress: 0.6,
      updatedAt: 60,
    }

    await Promise.all([firstService.save(first), secondService.save(second)])

    await expect(firstService.get(first.url)).resolves.toEqual(first)
    await expect(secondService.get(second.url)).resolves.toEqual(second)
  })

  it('orders same-page saves and clear operations without restoring stale progress', async () => {
    const stored: Record<string, unknown> = {}
    let activeWrites = 0
    let overlappingWrites = false
    let fullStorageReads = 0
    vi.stubGlobal('chrome', {
      storage: {
        local: {
          get: vi.fn(async (key: string | null) => {
            if (key === null) fullStorageReads += 1
            const snapshot = { ...stored }
            await Promise.resolve()
            return key === null ? snapshot : { [key]: snapshot[key] }
          }),
          set: vi.fn(async (changes: Record<string, unknown>) => {
            activeWrites += 1
            if (activeWrites > 1) overlappingWrites = true
            await Promise.resolve()
            Object.assign(stored, changes)
            activeWrites -= 1
          }),
          remove: vi.fn((keys: string | string[]) => {
            for (const key of Array.isArray(keys) ? keys : [keys]) delete stored[key]
          }),
        },
      },
    })
    const service = new ReadingProgressService()
    const progress = {
      url: 'https://example.com/same-page',
      documentId: 'same-page',
      source: 'article' as const,
      sentenceIndex: 2,
      progress: 0.2,
      updatedAt: 20,
    }

    const firstSave = service.save(progress)
    const secondSave = service.save({
      ...progress,
      sentenceIndex: 7,
      progress: 0.7,
      updatedAt: 70,
    })
    await Promise.all([firstSave, secondSave])

    expect(overlappingWrites).toBe(false)
    expect(fullStorageReads).toBe(1)
    await expect(service.get(progress.url)).resolves.toMatchObject({
      sentenceIndex: 7,
      progress: 0.7,
    })

    await Promise.all([service.save(progress), service.clear(progress.url)])
    await expect(service.get(progress.url)).resolves.toBeUndefined()
  })
})
