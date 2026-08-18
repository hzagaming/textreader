import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '@/services/settings/settings'
import {
  applyVoicePreset,
  createVoicePreset,
  removeVoicePreset,
  toggleFavoriteVoice,
  upsertVoicePreset,
} from './voice-presets'

describe('voice presets', () => {
  it('creates a trimmed preset from current voice settings', () => {
    expect(
      createVoicePreset(
        {
          ...DEFAULT_SETTINGS,
          voiceId: 'voice-en',
          readingLanguage: 'en',
          speed: 1.2,
        },
        '  Study  ',
        'preset-1',
        42,
      ),
    ).toEqual({
      id: 'preset-1',
      name: 'Study',
      voiceId: 'voice-en',
      readingLanguage: 'en',
      speed: 1.2,
      pitch: 0,
      volume: 1,
      naturalExpression: true,
      createdAt: 42,
    })
    expect(createVoicePreset(DEFAULT_SETTINGS, 'System default', 'id', 1)).toEqual({
      id: 'id',
      name: 'System default',
      voiceId: '',
      readingLanguage: 'auto',
      speed: 1,
      pitch: 0,
      volume: 1,
      naturalExpression: true,
      createdAt: 1,
    })
    expect(createVoicePreset(DEFAULT_SETTINGS, '   ', 'id', 1)).toBeUndefined()
  })

  it('upserts, applies, and removes bounded presets', () => {
    const preset = createVoicePreset(
      { ...DEFAULT_SETTINGS, voiceId: 'voice-ja', readingLanguage: 'ja' },
      'Japanese',
      'ja',
      1,
    )!
    const existing = Array.from({ length: 20 }, (_, index) => ({
      ...preset,
      id: `preset-${index}`,
      name: `Preset ${index}`,
    }))

    expect(upsertVoicePreset(existing, preset)).toHaveLength(20)
    expect(applyVoicePreset(preset)).toEqual({
      voiceId: 'voice-ja',
      readingLanguage: 'ja',
      speed: 1,
      pitch: 0,
      volume: 1,
      naturalExpression: true,
    })
    expect(removeVoicePreset([preset], 'ja')).toEqual([])
  })

  it('toggles favorites without duplicates and keeps the collection bounded', () => {
    expect(toggleFavoriteVoice(['one'], 'one')).toEqual([])
    expect(toggleFavoriteVoice(['one'], 'two')).toEqual(['two', 'one'])
    expect(
      toggleFavoriteVoice(
        Array.from({ length: 20 }, (_, index) => `v${index}`),
        'new',
      ),
    ).toHaveLength(20)
  })
})
