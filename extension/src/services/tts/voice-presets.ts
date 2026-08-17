import type { ReaderSettings, VoicePreset } from '@textreader/shared'

const MAX_VOICE_ITEMS = 20

export function createVoicePreset(
  settings: ReaderSettings,
  name: string,
  id: string = crypto.randomUUID(),
  createdAt = Date.now(),
): VoicePreset | undefined {
  const normalizedName = name.trim().slice(0, 60)
  if (!normalizedName || !settings.voiceId) return undefined
  return {
    id,
    name: normalizedName,
    voiceId: settings.voiceId,
    readingLanguage: settings.readingLanguage,
    speed: settings.speed,
    pitch: settings.pitch,
    volume: settings.volume,
    createdAt,
  }
}

export function upsertVoicePreset(
  current: readonly VoicePreset[],
  preset: VoicePreset,
): VoicePreset[] {
  return [preset, ...current.filter((candidate) => candidate.id !== preset.id)].slice(
    0,
    MAX_VOICE_ITEMS,
  )
}

export function removeVoicePreset(
  current: readonly VoicePreset[],
  presetId: string,
): VoicePreset[] {
  return current.filter((preset) => preset.id !== presetId)
}

export function applyVoicePreset(
  preset: VoicePreset,
): Pick<ReaderSettings, 'voiceId' | 'readingLanguage' | 'speed' | 'pitch' | 'volume'> {
  return {
    voiceId: preset.voiceId,
    readingLanguage: preset.readingLanguage,
    speed: preset.speed,
    pitch: preset.pitch,
    volume: preset.volume,
  }
}

export function toggleFavoriteVoice(
  current: readonly string[],
  voiceId: string,
): string[] {
  if (current.includes(voiceId)) return current.filter((id) => id !== voiceId)
  return [voiceId, ...current].slice(0, MAX_VOICE_ITEMS)
}
