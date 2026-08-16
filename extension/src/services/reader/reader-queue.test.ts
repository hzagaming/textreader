import { describe, expect, it } from 'vitest'
import { createReaderDocument } from './document-factory'
import { ReaderQueue } from './reader-queue'

const document = createReaderDocument({
  url: 'https://example.com',
  title: 'Queue test',
  paragraphs: ['One. Two.', 'Three. Four.'],
})

describe('ReaderQueue', () => {
  it('navigates sentences with clamped boundaries', () => {
    const queue = new ReaderQueue()
    queue.loadDocument(document)
    expect(queue.current()?.text).toBe('One.')
    expect(queue.previous()?.text).toBe('One.')
    expect(queue.next()?.text).toBe('Two.')
    expect(queue.jumpToSentence(99)?.text).toBe('Four.')
    expect(queue.next()?.text).toBe('Four.')
  })

  it('navigates paragraph boundaries and restarts', () => {
    const queue = new ReaderQueue()
    queue.loadDocument(document)
    expect(queue.jumpToParagraph(1)?.text).toBe('Three.')
    expect(queue.previousParagraph()?.text).toBe('One.')
    queue.jumpToSentence(3)
    expect(queue.restart()?.text).toBe('One.')
    queue.clear()
    expect(queue.current()).toBeUndefined()
  })

  it('counts repeated text before the current sentence or paragraph', () => {
    const repeatedDocument = createReaderDocument({
      url: 'https://example.com/repeated',
      title: 'Repeated text',
      paragraphs: [
        'Repeated sentence.',
        'Different sentence.',
        'Repeated sentence.',
        'Another sentence.',
        'Repeated sentence.',
      ],
    })
    const queue = new ReaderQueue()
    queue.loadDocument(repeatedDocument, 4)

    expect(queue.currentTextOccurrence('sentence')).toBe(2)
    expect(queue.currentTextOccurrence('paragraph')).toBe(2)
  })
})
