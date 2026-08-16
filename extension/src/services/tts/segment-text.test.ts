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
})
