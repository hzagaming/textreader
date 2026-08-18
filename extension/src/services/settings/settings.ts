import type {
  HighlightMode,
  ReaderSettings,
  ReadingLanguage,
  SupportedLanguage,
  ThemePreference,
  UiLanguage,
  VoicePreset,
} from '@textreader/shared'

const MAX_VOICE_ITEMS = 20

export const SETTINGS_STORAGE_KEY = 'readerSettings'

export const DEFAULT_SETTINGS: ReaderSettings = {
  schemaVersion: 3,
  voiceId: '',
  voiceByLanguage: { en: '', zh: '', ja: '', ko: '' },
  favoriteVoiceIds: [],
  recentVoiceIds: [],
  voicePresets: [],
  uiLanguage: 'auto',
  readingLanguage: 'auto',
  speed: 1,
  pitch: 0,
  volume: 1,
  autoShowSelectionButton: true,
  theme: 'system',
  highlightMode: 'sentence',
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function clampNumber(value: unknown, fallback: number, minimum: number, maximum: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(maximum, Math.max(minimum, value))
}

function normalizeTheme(value: unknown): ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system'
    ? value
    : DEFAULT_SETTINGS.theme
}

function normalizeHighlightMode(value: unknown): HighlightMode {
  return value === 'off' || value === 'sentence' || value === 'paragraph'
    ? value
    : DEFAULT_SETTINGS.highlightMode
}

function normalizeLanguage<T extends UiLanguage | ReadingLanguage>(
  value: unknown,
  fallback: T,
): T {
  return value === 'auto' ||
    value === 'en' ||
    value === 'zh' ||
    value === 'ja' ||
    value === 'ko'
    ? (value as T)
    : fallback
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ).slice(0, MAX_VOICE_ITEMS)
}

function normalizeVoiceByLanguage(value: unknown): Record<SupportedLanguage, string> {
  const record = isRecord(value) ? value : {}
  const voice = (language: SupportedLanguage) =>
    typeof record[language] === 'string' ? record[language].trim() : ''
  return { en: voice('en'), zh: voice('zh'), ja: voice('ja'), ko: voice('ko') }
}

function normalizeVoicePreset(value: unknown): VoicePreset | undefined {
  if (!isRecord(value)) return undefined
  const id = typeof value.id === 'string' ? value.id.trim() : ''
  const name = typeof value.name === 'string' ? value.name.trim().slice(0, 60) : ''
  const voiceId = typeof value.voiceId === 'string' ? value.voiceId.trim() : ''
  if (
    !id ||
    !name ||
    typeof value.voiceId !== 'string' ||
    typeof value.createdAt !== 'number' ||
    !Number.isFinite(value.createdAt)
  ) {
    return undefined
  }
  return {
    id,
    name,
    voiceId,
    readingLanguage: normalizeLanguage(value.readingLanguage, 'auto'),
    speed: clampNumber(value.speed, DEFAULT_SETTINGS.speed, 0.5, 2.5),
    pitch: clampNumber(value.pitch, DEFAULT_SETTINGS.pitch, -50, 50),
    volume: clampNumber(value.volume, DEFAULT_SETTINGS.volume, 0, 1),
    createdAt: value.createdAt,
  }
}

function normalizeVoicePresets(value: unknown): VoicePreset[] {
  if (!Array.isArray(value)) return []
  const presets = value
    .map(normalizeVoicePreset)
    .filter((preset): preset is VoicePreset => Boolean(preset))
  return Array.from(new Map(presets.map((preset) => [preset.id, preset])).values()).slice(
    0,
    MAX_VOICE_ITEMS,
  )
}

export function normalizeSettings(value: unknown): ReaderSettings {
  if (!isRecord(value)) return { ...DEFAULT_SETTINGS }

  const legacyVoice = typeof value.voice === 'string' ? value.voice : ''

  return {
    schemaVersion: 3,
    voiceId: typeof value.voiceId === 'string' ? value.voiceId : legacyVoice,
    voiceByLanguage: normalizeVoiceByLanguage(value.voiceByLanguage),
    favoriteVoiceIds: normalizeStringList(value.favoriteVoiceIds),
    recentVoiceIds: normalizeStringList(value.recentVoiceIds),
    voicePresets: normalizeVoicePresets(value.voicePresets),
    uiLanguage: normalizeLanguage(value.uiLanguage, DEFAULT_SETTINGS.uiLanguage),
    readingLanguage: normalizeLanguage(
      value.readingLanguage,
      DEFAULT_SETTINGS.readingLanguage,
    ),
    speed: clampNumber(value.speed, DEFAULT_SETTINGS.speed, 0.5, 2.5),
    pitch: clampNumber(value.pitch, DEFAULT_SETTINGS.pitch, -50, 50),
    volume: clampNumber(value.volume, DEFAULT_SETTINGS.volume, 0, 1),
    autoShowSelectionButton:
      typeof value.autoShowSelectionButton === 'boolean'
        ? value.autoShowSelectionButton
        : DEFAULT_SETTINGS.autoShowSelectionButton,
    theme: normalizeTheme(value.theme),
    highlightMode: normalizeHighlightMode(value.highlightMode),
  }
}

export class SettingsService {
  private updateQueue: Promise<void> = Promise.resolve()

  async get(): Promise<ReaderSettings> {
    const stored = await chrome.storage.local.get(SETTINGS_STORAGE_KEY)
    const settings = normalizeSettings(stored[SETTINGS_STORAGE_KEY])

    if (JSON.stringify(stored[SETTINGS_STORAGE_KEY]) !== JSON.stringify(settings)) {
      await chrome.storage.local.set({ [SETTINGS_STORAGE_KEY]: settings })
    }

    return settings
  }

  async update(
    patch: Partial<Omit<ReaderSettings, 'schemaVersion'>>,
  ): Promise<ReaderSettings> {
    const operation = this.updateQueue.then(async () => {
      const current = await this.get()
      const settings = normalizeSettings({ ...current, ...patch, schemaVersion: 3 })
      await chrome.storage.local.set({ [SETTINGS_STORAGE_KEY]: settings })
      return settings
    })
    this.updateQueue = operation.then(
      () => undefined,
      () => undefined,
    )
    return operation
  }

  subscribe(listener: (settings: ReaderSettings) => void): () => void {
    const handleChange: Parameters<typeof chrome.storage.onChanged.addListener>[0] = (
      changes,
      areaName,
    ) => {
      if (areaName !== 'local' || !changes[SETTINGS_STORAGE_KEY]) return
      listener(normalizeSettings(changes[SETTINGS_STORAGE_KEY].newValue))
    }

    chrome.storage.onChanged.addListener(handleChange)
    return () => chrome.storage.onChanged.removeListener(handleChange)
  }
}

export const settingsService = new SettingsService()
