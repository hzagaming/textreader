import { describe, expect, it } from 'vitest'
import { estimateSpeechSeconds, formatDuration } from './time'

describe('speech time utilities', () => {
  it('estimates Latin and CJK scripts consistently', () => {
    expect(
      estimateSpeechSeconds(Array.from({ length: 180 }, () => 'word').join(' '), 1),
    ).toBe(60)
    expect(estimateSpeechSeconds('中'.repeat(300), 1)).toBe(60)
    expect(estimateSpeechSeconds('한'.repeat(300), 1)).toBe(60)
    expect(estimateSpeechSeconds('한'.repeat(300), 2)).toBe(30)
  })

  it('formats safe non-negative durations', () => {
    expect(formatDuration(-20)).toBe('00:00')
    expect(formatDuration(125)).toBe('02:05')
  })
})
