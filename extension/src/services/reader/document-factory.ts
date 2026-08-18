import type { ReaderDocument, ReaderParagraph } from '@textreader/shared'
import { segmentText } from '@/services/tts/segment-text'

interface ReaderDocumentInput {
  url: string
  title: string
  paragraphs: string[]
  byline?: string
  siteName?: string
  language?: string
  createdAt?: number
}

function normalizeText(text: string): string {
  return text.replace(/\s+/gu, ' ').trim()
}

function hashText(text: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(36)
}

export function createReaderDocument(input: ReaderDocumentInput): ReaderDocument {
  const cleanParagraphs = input.paragraphs
    .map(normalizeText)
    .filter(Boolean)
    .filter((paragraph, index, items) => index === 0 || paragraph !== items[index - 1])
  const plainText = cleanParagraphs.join('\n\n')
  const id = `doc-${hashText(`${input.url}\u0000${input.title}\u0000${plainText}`)}`
  let sentenceIndex = 0

  const paragraphs: ReaderParagraph[] = cleanParagraphs.flatMap((text, index) => {
    const paragraphId = `${id}-p-${index}`
    const sentences = segmentText(text, input.language).map((sentence) => ({
      id: `${paragraphId}-s-${sentenceIndex}`,
      text: sentence,
      index: sentenceIndex++,
      paragraphId,
    }))

    return sentences.length > 0
      ? [{ id: paragraphId, text, index, sentences } satisfies ReaderParagraph]
      : []
  })

  return {
    id,
    url: input.url,
    title: normalizeText(input.title) || 'Untitled page',
    paragraphs,
    plainText,
    createdAt: input.createdAt ?? Date.now(),
    ...(input.byline ? { byline: normalizeText(input.byline) } : {}),
    ...(input.siteName ? { siteName: normalizeText(input.siteName) } : {}),
    ...(input.language ? { language: input.language } : {}),
  }
}
