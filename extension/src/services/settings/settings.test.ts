import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_SETTINGS,
  SETTINGS_STORAGE_KEY,
  SettingsService,
  normalizeSettings,
} from './settings'

afterEach(() => vi.unstubAllGlobals())

describe('normalizeSettings', () => {
  it('returns safe defaults for missing storage', () => {
    expect(normalizeSettings(undefined)).toEqual(DEFAULT_SETTINGS)
  })

  it('keeps supported values and clamps numeric settings', () => {
    expect(
      normalizeSettings({
        schemaVersion: 2,
        voiceId: 'Samantha',
        speed: 4,
        pitch: -70,
        volume: 2,
        autoShowSelectionButton: false,
        theme: 'dark',
      }),
    ).toEqual({
      ...DEFAULT_SETTINGS,
      voiceId: 'Samantha',
      speed: 2.5,
      pitch: -50,
      volume: 1,
      autoShowSelectionButton: false,
      theme: 'dark',
    })
  })

  it('migrates the legacy voice field without retaining unknown data', () => {
    expect(
      normalizeSettings({ voice: 'Legacy Voice', speed: 1.25, secret: 'drop-me' }),
    ).toEqual({
      ...DEFAULT_SETTINGS,
      voiceId: 'Legacy Voice',
      speed: 1.25,
    })
  })

  it('migrates Phase 1 settings to sentence highlighting', () => {
    expect(normalizeSettings({ schemaVersion: 1, theme: 'dark' })).toEqual({
      ...DEFAULT_SETTINGS,
      theme: 'dark',
      highlightMode: 'sentence',
    })
  })

  it('migrates Phase 2 settings to multilingual voice defaults', () => {
    expect(
      normalizeSettings({ schemaVersion: 2, voiceId: 'Samantha', theme: 'light' }),
    ).toMatchObject({
      schemaVersion: 3,
      uiLanguage: 'auto',
      readingLanguage: 'auto',
      voiceId: 'Samantha',
      voiceByLanguage: { en: '', zh: '', ja: '', ko: '' },
      favoriteVoiceIds: [],
      recentVoiceIds: [],
      voicePresets: [],
    })
  })

  it('drops malformed voice metadata and caps user collections', () => {
    const normalized = normalizeSettings({
      schemaVersion: 3,
      favoriteVoiceIds: ['a', 'a', 2, ...Array.from({ length: 30 }, (_, i) => `f${i}`)],
      recentVoiceIds: Array.from({ length: 30 }, (_, i) => `r${i}`),
      voicePresets: [
        {
          id: 'calm',
          name: 'Calm',
          voiceId: 'voice-en',
          readingLanguage: 'en',
          speed: 9,
          pitch: -80,
          volume: 3,
          createdAt: 10,
        },
        { id: '', name: '', voiceId: '' },
      ],
    })

    expect(normalized.favoriteVoiceIds).toHaveLength(20)
    expect(normalized.recentVoiceIds).toHaveLength(20)
    expect(normalized.voicePresets).toEqual([
      {
        id: 'calm',
        name: 'Calm',
        voiceId: 'voice-en',
        readingLanguage: 'en',
        speed: 2.5,
        pitch: -50,
        volume: 1,
        createdAt: 10,
      },
    ])
  })

  it('serializes rapid updates so a slower write cannot discard a newer field', async () => {
    const stored: Record<string, unknown> = {
      [SETTINGS_STORAGE_KEY]: { ...DEFAULT_SETTINGS },
    }
    let activeWrites = 0
    let overlappingWrites = false
    vi.stubGlobal('chrome', {
      storage: {
        local: {
          get: vi.fn(() => ({ ...stored })),
          set: vi.fn(async (changes: Record<string, unknown>) => {
            activeWrites += 1
            if (activeWrites > 1) overlappingWrites = true
            await Promise.resolve()
            Object.assign(stored, changes)
            activeWrites -= 1
          }),
        },
      },
    })
    const service = new SettingsService()

    await Promise.all([service.update({ speed: 1.4 }), service.update({ theme: 'dark' })])

    expect(overlappingWrites).toBe(false)
    expect(stored[SETTINGS_STORAGE_KEY]).toMatchObject({ speed: 1.4, theme: 'dark' })
  })
})
