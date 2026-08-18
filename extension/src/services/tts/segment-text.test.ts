import { describe, expect, it } from 'vitest'
import { segmentText } from './segment-text'

describe('segmentText', () => {
  it('segments common English and CJK punctuation', () => {
    expect(segmentText('Hello world. How are you?')).toEqual([
      'Hello world.',
      'How are you?',
    ])
    expect(segmentText('你好。今天好吗？很好！')).toEqual([
      '你好。',
      '今天好吗？',
      '很好！',
    ])
  })

  it('returns a trimmed fallback for text without punctuation', () => {
    expect(segmentText('  one short selection  ')).toEqual(['one short selection'])
  })

  it('does not emit empty segments', () => {
    expect(segmentText('...   ')).toEqual(['...'])
  })

  it('keeps common abbreviations and decimals inside their sentences', () => {
    expect(segmentText('Dr. Lee measured 3.14 units. It worked.')).toEqual([
      'Dr. Lee measured 3.14 units.',
      'It worked.',
    ])
    expect(segmentText('The U.S. team agreed. Next topic.')).toEqual([
      'The U.S. team agreed.',
      'Next topic.',
    ])
  })

  it('keeps URLs, email addresses, and numbered abbreviations intact', () => {
    expect(
      segmentText(
        'See https://docs.example.com/v2.1/guide and mail help@example.com. No. 2 is next.',
      ),
    ).toEqual([
      'See https://docs.example.com/v2.1/guide and mail help@example.com.',
      'No. 2 is next.',
    ])
  })

  it('keeps closing punctuation with mixed-language sentences', () => {
    expect(segmentText('他说：“Really?”然后继续。次はどうする？좋아요!')).toEqual([
      '他说：“Really?”',
      '然后继续。',
      '次はどうする？',
      '좋아요!',
    ])
  })

  it('splits unusually long sentences at natural clause boundaries', () => {
    const firstClause = `A ${'carefully paced phrase '.repeat(8)}`
    const secondClause = `however ${'another clear phrase '.repeat(8)}`
    const segments = segmentText(`${firstClause}; ${secondClause}.`)

    expect(segments.length).toBeGreaterThan(1)
    expect(segments.join(' ')).toBe(`${firstClause}; ${secondClause}.`)
    expect(segments.every((segment) => segment.length <= 280)).toBe(true)
  })

  it('uses deliberate ellipses as pauses without splitting hesitation', () => {
    expect(segmentText('Wait... Really? I... think so.')).toEqual([
      'Wait...',
      'Really?',
      'I... think so.',
    ])
  })

  it('avoids a tiny trailing fragment when balancing a long sentence', () => {
    const text = `${'balanced words '.repeat(19)}, ${'short tail '.repeat(4)}done.`
    const segments = segmentText(text)

    expect(segments.length).toBeGreaterThan(1)
    expect(segments.every((segment) => segment.length >= 50)).toBe(true)
    expect(segments.join(' ')).toBe(text.trim())
  })

  it('falls back safely for malformed webpage language tags', () => {
    expect(segmentText('First sentence. 第二句。', 'not_a_valid_locale!')).toEqual([
      'First sentence.',
      '第二句。',
    ])
  })
})
