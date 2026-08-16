import type { HighlightMode, ReaderSettings, ThemePreference } from '@textreader/shared'

export const SETTINGS_STORAGE_KEY = 'readerSettings'

export const DEFAULT_SETTINGS: ReaderSettings = {
  schemaVersion: 2,
  voiceId: '',
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

export function normalizeSettings(value: unknown): ReaderSettings {
  if (!isRecord(value)) return { ...DEFAULT_SETTINGS }

  const legacyVoice = typeof value.voice === 'string' ? value.voice : ''

  return {
    schemaVersion: 2,
    voiceId: typeof value.voiceId === 'string' ? value.voiceId : legacyVoice,
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
      const settings = normalizeSettings({ ...current, ...patch, schemaVersion: 2 })
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
