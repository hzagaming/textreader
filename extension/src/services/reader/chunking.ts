import type { ReaderSentence, SpeechChunk } from '@textreader/shared'

interface ChunkOptions {
  minimum?: number
  maximum?: number
}

interface ChunkPart {
  text: string
  sentenceIds: string[]
}

function splitLongText(text: string, maximum: number): string[] {
  const words = text.split(/\s+/u)
  const parts: string[] = []
  let current = ''

  for (const word of words) {
    if (word.length > maximum) {
      if (current) parts.push(current)
      if (/\p{Script=Han}|\p{Script=Hiragana}|\p{Script=Katakana}/u.test(word)) {
        for (let index = 0; index < word.length; index += maximum) {
          parts.push(word.slice(index, index + maximum))
        }
      } else {
        parts.push(word)
      }
      current = ''
      continue
    }

    const candidate = current ? `${current} ${word}` : word
    if (candidate.length > maximum) {
      if (current) parts.push(current)
      current = word
    } else {
      current = candidate
    }
  }

  if (current) parts.push(current)
  return parts
}

export function createSpeechChunks(
  sentences: readonly ReaderSentence[],
  options: ChunkOptions = {},
): SpeechChunk[] {
  const minimum = Math.max(1, options.minimum ?? 200)
  const maximum = Math.max(minimum, options.maximum ?? 500)
  const parts: ChunkPart[] = []
  let pending: ChunkPart = { text: '', sentenceIds: [] }

  const flush = () => {
    if (pending.text) parts.push(pending)
    pending = { text: '', sentenceIds: [] }
  }

  for (const sentence of sentences) {
    if (sentence.text.length > maximum) {
      flush()
      for (const text of splitLongText(sentence.text, maximum)) {
        parts.push({ text, sentenceIds: [sentence.id] })
      }
      continue
    }

    const candidate = pending.text ? `${pending.text} ${sentence.text}` : sentence.text
    if (candidate.length > maximum) flush()
    pending = {
      text: pending.text ? `${pending.text} ${sentence.text}` : sentence.text,
      sentenceIds: [...pending.sentenceIds, sentence.id],
    }
  }
  flush()

  const last = parts.at(-1)
  const previous = parts.at(-2)
  if (
    last &&
    previous &&
    last.text.length < minimum &&
    previous.text.length + 1 + last.text.length <= maximum
  ) {
    previous.text = `${previous.text} ${last.text}`
    previous.sentenceIds.push(...last.sentenceIds)
    parts.pop()
  }

  return parts.map((part, index) => ({
    id: `chunk-${index}-${part.sentenceIds[0] ?? 'empty'}`,
    sentenceIds: part.sentenceIds,
    text: part.text,
    charCount: part.text.length,
  }))
}
