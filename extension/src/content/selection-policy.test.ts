import { describe, expect, it } from 'vitest'
import { isMeaningfulSelectionText } from './selection-policy'

describe('isMeaningfulSelectionText', () => {
  it('accepts meaningful multilingual selections', () => {
    expect(isMeaningfulSelectionText('AI')).toBe(true)
    expect(isMeaningfulSelectionText('你好')).toBe(true)
  })

  it('rejects empty, whitespace, and punctuation-only selections', () => {
    expect(isMeaningfulSelectionText('')).toBe(false)
    expect(isMeaningfulSelectionText('   \n')).toBe(false)
    expect(isMeaningfulSelectionText('...')).toBe(false)
    expect(isMeaningfulSelectionText('a')).toBe(false)
  })
})
