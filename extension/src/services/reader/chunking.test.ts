import type { ReaderSentence } from '@textreader/shared'
import { describe, expect, it } from 'vitest'
import { createSpeechChunks } from './chunking'

function sentence(index: number, text: string): ReaderSentence {
  return { id: `s-${index}`, paragraphId: 'p-0', index, text }
}

describe('createSpeechChunks', () => {
  it('combines complete sentences into bounded chunks', () => {
    const sentences = Array.from({ length: 8 }, (_, index) =>
      sentence(index, `Sentence ${index} ${'word '.repeat(12).trim()}.`),
    )
    const chunks = createSpeechChunks(sentences, { minimum: 120, maximum: 240 })

    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks.every((chunk) => chunk.charCount <= 240)).toBe(true)
    expect(chunks.flatMap((chunk) => chunk.sentenceIds)).toEqual(
      sentences.map((item) => item.id),
    )
  })

  it('splits an exceptional long sentence without cutting Latin words', () => {
    const chunks = createSpeechChunks(
      [sentence(0, Array.from({ length: 100 }, (_, index) => `word${index}`).join(' '))],
      { minimum: 80, maximum: 120 },
    )
    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks.every((chunk) => chunk.charCount <= 120)).toBe(true)
    expect(chunks.map((chunk) => chunk.text).join(' ')).toContain('word99')
  })

  it('keeps an indivisible Latin token intact', () => {
    const token = 'a'.repeat(140)
    const chunks = createSpeechChunks([sentence(0, token)], {
      minimum: 80,
      maximum: 120,
    })

    expect(chunks).toHaveLength(1)
    expect(chunks[0]?.text).toBe(token)
  })
})
