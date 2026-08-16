import { describe, expect, it } from 'vitest'
import { createReaderDocument } from './document-factory'

describe('createReaderDocument', () => {
  it('creates stable paragraphs and globally indexed multilingual sentences', () => {
    const document = createReaderDocument({
      url: 'https://example.com/story',
      title: 'A story',
      paragraphs: ['First sentence. Second sentence.', '你好。今日は晴れです。'],
      createdAt: 100,
    })

    expect(document.paragraphs).toHaveLength(2)
    expect(
      document.paragraphs
        .flatMap((paragraph) => paragraph.sentences)
        .map((sentence) => sentence.index),
    ).toEqual([0, 1, 2, 3])
    expect(document.plainText).toBe(
      'First sentence. Second sentence.\n\n你好。今日は晴れです。',
    )
    expect(document.id).toBe(
      createReaderDocument({
        url: 'https://example.com/story',
        title: 'A story',
        paragraphs: ['First sentence. Second sentence.', '你好。今日は晴れです。'],
        createdAt: 999,
      }).id,
    )
  })

  it('drops empty and duplicate adjacent paragraphs', () => {
    const document = createReaderDocument({
      url: 'https://example.com',
      title: 'Example',
      paragraphs: [' One paragraph. ', '', 'One paragraph.', 'Another paragraph.'],
    })
    expect(document.paragraphs.map((paragraph) => paragraph.text)).toEqual([
      'One paragraph.',
      'Another paragraph.',
    ])
  })
})
