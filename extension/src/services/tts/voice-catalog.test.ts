import { describe, expect, it } from 'vitest'
import {
  addRecentVoice,
  canonicalizeVoiceIds,
  filterVoices,
  selectVoiceForLanguage,
  voiceIdentity,
  voiceMatchesId,
} from './voice-catalog'

function voice(
  name: string,
  lang: string,
  options: { default?: boolean; localService?: boolean } = {},
): SpeechSynthesisVoice {
  return {
    name,
    lang,
    voiceURI: `${name}-${lang}`,
    default: options.default ?? false,
    localService: options.localService ?? true,
  }
}

const voices = [
  voice('English Local', 'en-US', { default: true }),
  voice('中文语音', 'zh-CN'),
  voice('日本語 Voice', 'ja-JP'),
  voice('한국어 Voice', 'ko-KR'),
]

describe('voice catalog', () => {
  it('searches voices and filters by normalized language', () => {
    expect(filterVoices(voices, { query: 'voice', language: 'ja' })).toEqual([voices[2]])
    expect(filterVoices(voices, { query: '', language: 'zh' })).toEqual([voices[1]])
  })

  it('prefers a mapped voice but falls back to a matching local language', () => {
    expect(selectVoiceForLanguage(voices, voices[1]!.voiceURI, 'zh')).toBe(voices[1])
    expect(selectVoiceForLanguage(voices, 'missing', 'ja')).toBe(voices[2])
  })

  it('distinguishes persisted voices with the same browser ID by locale', () => {
    const traditional = {
      ...voice('Shared', 'zh-TW', { default: true }),
      voiceURI: 'shared',
    }
    const chinese = { ...voice('Shared', 'zh-CN'), voiceURI: 'shared' }
    const chineseId = voiceIdentity(chinese)

    expect(chineseId).not.toBe(voiceIdentity(traditional))
    expect(voiceMatchesId(chinese, chineseId)).toBe(true)
    expect(voiceMatchesId(traditional, chineseId)).toBe(false)
    expect(voiceMatchesId(traditional, 'shared')).toBe(true)
    expect(selectVoiceForLanguage([traditional, chinese], chineseId, 'zh')).toBe(chinese)
    expect(
      filterVoices([traditional, chinese], {
        query: '',
        language: 'all',
        favoriteIds: [chineseId],
        favoritesOnly: true,
      }),
    ).toEqual([chinese])
    expect(canonicalizeVoiceIds(['shared'], [traditional, chinese])).toEqual([
      voiceIdentity(traditional),
      chineseId,
    ])
  })

  it('prefers an exact locale before a broader language default', () => {
    const britishDefault = voice('British Default', 'en-GB', {
      default: true,
      localService: false,
    })
    const americanLocal = voice('American Local', 'en_US')

    expect(
      selectVoiceForLanguage([britishDefault, americanLocal], undefined, 'en', 'en-US'),
    ).toBe(americanLocal)
    expect(
      selectVoiceForLanguage([britishDefault, americanLocal], undefined, 'en', 'en-AU'),
    ).toBe(britishDefault)
  })

  it('keeps recent voices unique, newest first, and bounded', () => {
    const existing = Array.from({ length: 20 }, (_, index) => `voice-${index}`)
    expect(addRecentVoice(existing, 'voice-4')).toEqual([
      'voice-4',
      ...existing.filter((id) => id !== 'voice-4'),
    ])
    expect(addRecentVoice(existing, 'new-voice')).toHaveLength(20)
  })
})
