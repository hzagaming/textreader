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

function normalizeLocale(value: string | undefined): string {
  return (value ?? '').trim().replaceAll('_', '-').toLocaleLowerCase()
}

export function voiceIdentity(voice: SpeechSynthesisVoice): string {
  return `${voiceId(voice)}\u0000${normalizeLocale(voice.lang)}`
}

function preferredVoice(
  voices: readonly SpeechSynthesisVoice[],
): SpeechSynthesisVoice | undefined {
  return (
    voices.find((voice) => voice.default) ??
    voices.find((voice) => voice.localService) ??
    voices[0]
  )
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
  preferredLocale?: string,
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
  const locale = normalizeLocale(preferredLocale)
  const exactLocale = locale
    ? matching.filter((voice) => normalizeLocale(voice.lang) === locale)
    : []
  return (
    preferredVoice(exactLocale) ??
    preferredVoice(matching) ??
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
