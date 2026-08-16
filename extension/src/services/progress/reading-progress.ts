import type { ReadingProgress } from '@textreader/shared'

const PROGRESS_STORAGE_PREFIX = 'readingProgress:'
const MAX_PROGRESS_ITEMS = 100

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function normalizeReadingProgress(value: unknown): ReadingProgress | undefined {
  if (!isRecord(value)) return undefined
  if (
    typeof value.url !== 'string' ||
    typeof value.documentId !== 'string' ||
    (value.source !== 'article' && value.source !== 'page') ||
    typeof value.sentenceIndex !== 'number' ||
    !Number.isFinite(value.sentenceIndex) ||
    typeof value.progress !== 'number' ||
    !Number.isFinite(value.progress) ||
    typeof value.updatedAt !== 'number' ||
    !Number.isFinite(value.updatedAt)
  ) {
    return undefined
  }

  return {
    url: value.url,
    documentId: value.documentId,
    source: value.source,
    sentenceIndex: Math.max(0, Math.trunc(value.sentenceIndex)),
    progress: Math.min(1, Math.max(0, value.progress)),
    updatedAt: value.updatedAt,
  }
}

export class ReadingProgressService {
  private mutationQueue: Promise<void> = Promise.resolve()
  private pruned = false

  async get(url: string): Promise<ReadingProgress | undefined> {
    const key = this.key(url)
    const stored = await chrome.storage.local.get(key)
    return normalizeReadingProgress(stored[key])
  }

  save(progress: ReadingProgress): Promise<void> {
    const normalized = normalizeReadingProgress(progress)
    if (!normalized) return Promise.resolve()
    return this.enqueue(async () => {
      await chrome.storage.local.set({ [this.key(progress.url)]: normalized })
      if (!this.pruned) {
        await this.prune()
        this.pruned = true
      }
    })
  }

  clear(url: string): Promise<void> {
    return this.enqueue(() => chrome.storage.local.remove(this.key(url)))
  }

  private key(url: string): string {
    return `${PROGRESS_STORAGE_PREFIX}${url}`
  }

  private async prune(): Promise<void> {
    const stored = await chrome.storage.local.get(null)
    const staleKeys = Object.entries(stored)
      .filter(([key]) => key.startsWith(PROGRESS_STORAGE_PREFIX))
      .map(([key, value]) => ({ key, progress: normalizeReadingProgress(value) }))
      .sort(
        (left, right) =>
          (right.progress?.updatedAt ?? -1) - (left.progress?.updatedAt ?? -1),
      )
      .slice(MAX_PROGRESS_ITEMS)
      .map(({ key }) => key)
    if (staleKeys.length > 0) await chrome.storage.local.remove(staleKeys)
  }

  private enqueue(operation: () => Promise<void>): Promise<void> {
    const queued = this.mutationQueue.then(operation)
    this.mutationQueue = queued.catch(() => undefined)
    return queued
  }
}

export const readingProgressService = new ReadingProgressService()
