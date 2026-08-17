import type { SupportedLanguage } from '@textreader/shared'
import { normalizeSupportedLanguage } from '@/services/language/language'

const MAX_RECENT_VOICES = 20

export type VoiceFilterLanguage = 'all' | 'other' | SupportedLanguage

interface VoiceFilter {
  query: string
  language: VoiceFilterLanguage
  favoriteIds?: readonly string[]
  favoritesOnly?: boolean
}

function voiceId(voice: SpeechSynthesisVoice): string {
  return voice.voiceURI || voice.name
}

export function filterVoices(
  voices: readonly SpeechSynthesisVoice[],
  filter: VoiceFilter,
): SpeechSynthesisVoice[] {
  const query = filter.query.trim().toLocaleLowerCase()
  const favorites = new Set(filter.favoriteIds ?? [])
  return voices.filter((voice) => {
    const language = normalizeSupportedLanguage(voice.lang)
    if (filter.language === 'other' && language) return false
    if (filter.language !== 'all' && filter.language !== 'other') {
      if (language !== filter.language) return false
    }
    if (filter.favoritesOnly && !favorites.has(voiceId(voice))) return false
    if (!query) return true
    return `${voice.name} ${voice.lang}`.toLocaleLowerCase().includes(query)
  })
}

export function selectVoiceForLanguage(
  voices: readonly SpeechSynthesisVoice[],
  preferredVoiceId: string | undefined,
  language: SupportedLanguage,
): SpeechSynthesisVoice | undefined {
  const preferred = preferredVoiceId
    ? voices.find(
        (voice) => voice.voiceURI === preferredVoiceId || voice.name === preferredVoiceId,
      )
    : undefined
  const matching = voices.filter(
    (voice) => normalizeSupportedLanguage(voice.lang) === language,
  )
  if (preferred && normalizeSupportedLanguage(preferred.lang) === language)
    return preferred
  return (
    matching.find((voice) => voice.default) ??
    matching.find((voice) => voice.localService) ??
    matching[0] ??
    preferred ??
    voices.find((voice) => voice.default) ??
    voices[0]
  )
}

export function addRecentVoice(
  current: readonly string[],
  nextVoiceId: string,
): string[] {
  const id = nextVoiceId.trim()
  if (!id) return [...current]
  return [id, ...current.filter((candidate) => candidate !== id)].slice(
    0,
    MAX_RECENT_VOICES,
  )
}
