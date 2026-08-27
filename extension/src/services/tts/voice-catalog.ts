import type { SupportedLanguage } from '@textreader/shared'
import { normalizeSupportedLanguage } from '@/services/language/language'

const MAX_RECENT_VOICES = 20
const VOICE_ID_PREFIX = 'textreader-voice:'

export type VoiceFilterLanguage = 'all' | 'other' | SupportedLanguage

interface VoiceFilter {
  query: string
  language: VoiceFilterLanguage
  favoriteIds?: readonly string[]
  favoritesOnly?: boolean
}

function browserVoiceId(voice: SpeechSynthesisVoice): string {
  return voice.voiceURI || voice.name
}

function normalizeLocale(value: string | undefined): string {
  return (value ?? '').trim().replaceAll('_', '-').toLocaleLowerCase()
}

export function voiceIdentity(voice: SpeechSynthesisVoice): string {
  return `${VOICE_ID_PREFIX}${encodeURIComponent(browserVoiceId(voice))}:${encodeURIComponent(normalizeLocale(voice.lang))}`
}

export function voiceMatchesId(
  voice: SpeechSynthesisVoice,
  storedId: string | undefined,
): boolean {
  const id = storedId?.trim()
  if (!id) return false
  if (id.startsWith(VOICE_ID_PREFIX)) return id === voiceIdentity(voice)
  return id === voice.voiceURI || id === voice.name
}

export function canonicalizeVoiceIds(
  ids: readonly string[],
  voices: readonly SpeechSynthesisVoice[],
): string[] {
  const canonical: string[] = []
  for (const storedId of ids) {
    const matches = voices.filter((voice) => voiceMatchesId(voice, storedId))
    const replacements = matches.length ? matches.map(voiceIdentity) : [storedId.trim()]
    for (const id of replacements) {
      if (id && !canonical.includes(id)) canonical.push(id)
    }
  }
  return canonical
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
    if (filter.favoritesOnly && ![...favorites].some((id) => voiceMatchesId(voice, id)))
      return false
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
    ? voices.find((voice) => voiceMatchesId(voice, preferredVoiceId))
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
