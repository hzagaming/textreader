import { describe, expect, it } from 'vitest'
import { naturalProsody } from './natural-prosody'

describe('naturalProsody', () => {
  it('recognizes expressive punctuation before multilingual closing marks', () => {
    expect(
      naturalProsody('本当に？』', { rate: 1, pitch: 1, volume: 0.8 }, true),
    ).toEqual({ rate: 0.97, pitch: 1.08, volume: 0.8 })
    expect(
      naturalProsody('让我想想……」', { rate: 1, pitch: 1, volume: 0.8 }, true),
    ).toEqual({ rate: 0.92, pitch: 0.96, volume: 0.8 })
  })

  it('keeps all configured values unchanged when expression is disabled', () => {
    const base = { rate: 1.4, pitch: 1.5, volume: 0.7 }
    expect(naturalProsody('Really?', base, false)).toBe(base)
  })
})
