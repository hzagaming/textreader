import { useMemo, useState } from 'react'
import type { ReaderSettings, SupportedLanguage, VoicePreset } from '@textreader/shared'
import type { Translator } from '@/services/i18n/i18n'
import { normalizeSupportedLanguage } from '@/services/language/language'
import {
  addRecentVoice,
  filterVoices,
  selectVoiceForLanguage,
  type VoiceFilterLanguage,
} from '@/services/tts/voice-catalog'
import {
  applyVoicePreset,
  createVoicePreset,
  removeVoicePreset,
  toggleFavoriteVoice,
  upsertVoicePreset,
} from '@/services/tts/voice-presets'

const LANGUAGES: readonly SupportedLanguage[] = ['en', 'zh', 'ja', 'ko']

type SettingsPatch = Partial<Omit<ReaderSettings, 'schemaVersion'>>

interface VoiceLibraryProps {
  settings: ReaderSettings
  voices: SpeechSynthesisVoice[]
  translator: Translator
  previewDisabled: boolean
  previewPlaying: boolean
  onUpdate: (patch: SettingsPatch) => Promise<boolean>
  onPreview: (voice: SpeechSynthesisVoice, language: SupportedLanguage) => void
  onStopPreview: () => void
}

function idOf(voice: SpeechSynthesisVoice): string {
  return voice.voiceURI || voice.name
}

function languageKey(
  language: SupportedLanguage,
): 'english' | 'chinese' | 'japanese' | 'korean' {
  const keys = {
    en: 'english',
    zh: 'chinese',
    ja: 'japanese',
    ko: 'korean',
  } as const
  return keys[language]
}

export function VoiceLibrary({
  settings,
  voices,
  translator: t,
  previewDisabled,
  previewPlaying,
  onUpdate,
  onPreview,
  onStopPreview,
}: VoiceLibraryProps) {
  const [query, setQuery] = useState('')
  const [languageFilter, setLanguageFilter] = useState<VoiceFilterLanguage>('all')
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [presetName, setPresetName] = useState('')
  const favorites = useMemo(
    () => new Set(settings.favoriteVoiceIds),
    [settings.favoriteVoiceIds],
  )
  const recent = useMemo(
    () => new Map(settings.recentVoiceIds.map((id, index) => [id, index])),
    [settings.recentVoiceIds],
  )
  const filteredVoices = useMemo(() => {
    const filtered = filterVoices(voices, {
      query,
      language: languageFilter,
      favoriteIds: settings.favoriteVoiceIds,
      favoritesOnly,
    })
    return filtered
      .map((voice, index) => ({
        voice,
        index,
        priority:
          idOf(voice) === settings.voiceId
            ? -100
            : favorites.has(idOf(voice))
              ? -50
              : (recent.get(idOf(voice)) ?? 100),
      }))
      .sort((left, right) => left.priority - right.priority || left.index - right.index)
      .slice(0, 60)
      .map(({ voice }) => voice)
  }, [favorites, favoritesOnly, languageFilter, query, recent, settings, voices])
  const selectedVoice = voices.find(
    (voice) => idOf(voice) === settings.voiceId || voice.name === settings.voiceId,
  )
  const previewLanguage =
    settings.readingLanguage === 'auto'
      ? (normalizeSupportedLanguage(selectedVoice?.lang) ?? 'en')
      : settings.readingLanguage
  const previewVoice =
    selectedVoice ?? selectVoiceForLanguage(voices, undefined, previewLanguage)
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const showSystemDefault =
    !favoritesOnly &&
    languageFilter === 'all' &&
    (!normalizedQuery || t('systemDefault').toLocaleLowerCase().includes(normalizedQuery))

  const selectVoice = async (voiceId: string) => {
    await onUpdate({
      voiceId,
      recentVoiceIds: voiceId
        ? addRecentVoice(settings.recentVoiceIds, voiceId)
        : settings.recentVoiceIds,
    })
  }

  const updateLanguageVoice = async (language: SupportedLanguage, voiceId: string) => {
    await onUpdate({
      voiceByLanguage: { ...settings.voiceByLanguage, [language]: voiceId },
      recentVoiceIds: voiceId
        ? addRecentVoice(settings.recentVoiceIds, voiceId)
        : settings.recentVoiceIds,
    })
  }

  const savePreset = async () => {
    const preset = createVoicePreset(settings, presetName)
    if (!preset) return
    const saved = await onUpdate({
      voicePresets: upsertVoicePreset(settings.voicePresets, preset),
    })
    if (saved) setPresetName('')
  }

  const applyPreset = async (preset: VoicePreset) => {
    await onUpdate({
      ...applyVoicePreset(preset),
      recentVoiceIds: preset.voiceId
        ? addRecentVoice(settings.recentVoiceIds, preset.voiceId)
        : settings.recentVoiceIds,
    })
  }

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="mb-2 block text-[12px] font-medium">{t('readingLanguage')}</span>
        <select
          className="h-10 w-full rounded-xl border border-[var(--tr-border)] bg-[var(--tr-surface-strong)] px-3 text-[13px]"
          value={settings.readingLanguage}
          onChange={(event) =>
            void onUpdate({
              readingLanguage: event.target.value as ReaderSettings['readingLanguage'],
            })
          }
        >
          <option value="auto">{t('automaticPerSentence')}</option>
          {LANGUAGES.map((language) => (
            <option key={language} value={language}>
              {t(languageKey(language))}
            </option>
          ))}
        </select>
      </label>

      <div className="flex items-center justify-between gap-3 rounded-xl bg-[var(--tr-soft)] px-3 py-2.5">
        <div className="min-w-0">
          <p className="m-0 text-[12px] font-medium">{t('naturalExpression')}</p>
          <p className="mb-0 mt-1 text-[10px] leading-4 text-[var(--tr-muted)]">
            {t('naturalExpressionDescription')}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={settings.naturalExpression}
          aria-label={t('naturalExpression')}
          className={`relative h-6 w-10 shrink-0 rounded-full transition ${settings.naturalExpression ? 'bg-[var(--tr-accent)]' : 'bg-[var(--tr-surface-strong)]'}`}
          onClick={() =>
            void onUpdate({ naturalExpression: !settings.naturalExpression })
          }
        >
          <span
            className={`absolute top-1 size-4 rounded-full bg-white shadow-sm transition ${settings.naturalExpression ? 'left-5' : 'left-1'}`}
          />
        </button>
      </div>

      {settings.readingLanguage === 'auto' && (
        <fieldset className="rounded-xl border border-[var(--tr-border)] p-3">
          <legend className="px-1 text-[11px] font-semibold">
            {t('voicePerLanguage')}
          </legend>
          <div className="space-y-2">
            {LANGUAGES.map((language) => (
              <label
                key={language}
                className="grid grid-cols-[70px_minmax(0,1fr)] items-center gap-2 text-[11px]"
              >
                <span>{t(languageKey(language))}</span>
                <select
                  className="h-8 min-w-0 rounded-lg border border-[var(--tr-border)] bg-[var(--tr-surface-strong)] px-2"
                  value={settings.voiceByLanguage[language]}
                  onChange={(event) =>
                    void updateLanguageVoice(language, event.target.value)
                  }
                >
                  <option value="">{t('useAutomaticVoice')}</option>
                  {filterVoices(voices, { query: '', language }).map((voice) => (
                    <option key={idOf(voice)} value={idOf(voice)}>
                      {voice.name}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <section aria-label={t('voiceLibrary')}>
        {settings.voiceId && !selectedVoice && (
          <p className="mb-2 mt-0 text-[11px] text-[var(--tr-muted)]">
            {t('unavailableSavedVoice')}
          </p>
        )}
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-[12px] font-semibold">{t('voiceLibrary')}</span>
          <label className="flex items-center gap-1.5 text-[11px] text-[var(--tr-muted)]">
            <input
              type="checkbox"
              checked={favoritesOnly}
              onChange={(event) => setFavoritesOnly(event.target.checked)}
            />
            {t('favoritesOnly')}
          </label>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_110px] gap-2">
          <input
            type="search"
            maxLength={80}
            className="h-9 min-w-0 rounded-lg border border-[var(--tr-border)] bg-[var(--tr-surface-strong)] px-2.5 text-[12px]"
            placeholder={t('searchVoices')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <select
            className="h-9 rounded-lg border border-[var(--tr-border)] bg-[var(--tr-surface-strong)] px-2 text-[11px]"
            value={languageFilter}
            aria-label={t('readingLanguage')}
            onChange={(event) =>
              setLanguageFilter(event.target.value as VoiceFilterLanguage)
            }
          >
            <option value="all">{t('allLanguages')}</option>
            {LANGUAGES.map((language) => (
              <option key={language} value={language}>
                {t(languageKey(language))}
              </option>
            ))}
            <option value="other">{t('otherLanguages')}</option>
          </select>
        </div>

        <div className="mt-2 max-h-44 space-y-1 overflow-y-auto pr-1" role="list">
          {showSystemDefault && (
            <div
              className={`grid grid-cols-[minmax(0,1fr)_38px] items-center rounded-lg border ${settings.voiceId ? 'border-transparent' : 'border-[var(--tr-focus)] bg-[var(--tr-highlight)]'}`}
              role="listitem"
            >
              <button
                type="button"
                className="col-span-2 min-w-0 px-2.5 py-2 text-left text-[11px]"
                aria-pressed={!settings.voiceId}
                onClick={() => void selectVoice('')}
              >
                {t('systemDefault')}
              </button>
            </div>
          )}
          {filteredVoices.map((voice) => {
            const id = idOf(voice)
            const selected = id === settings.voiceId || voice.name === settings.voiceId
            const favorite = favorites.has(id)
            return (
              <div
                key={`${id}-${voice.lang}`}
                className={`grid grid-cols-[minmax(0,1fr)_38px] items-center rounded-lg border ${selected ? 'border-[var(--tr-focus)] bg-[var(--tr-highlight)]' : 'border-transparent hover:bg-[var(--tr-soft)]'}`}
                role="listitem"
              >
                <button
                  type="button"
                  className="min-w-0 px-2.5 py-1.5 text-left"
                  aria-pressed={selected}
                  onClick={() => void selectVoice(id)}
                >
                  <span className="block truncate text-[11px] font-medium">
                    {voice.name}
                  </span>
                  <span className="block text-[10px] text-[var(--tr-muted)]">
                    {voice.lang}
                    {` · ${t(voice.localService ? 'onDeviceVoice' : 'networkVoice')}`}
                    {recent.has(id) ? ` · ${t('recentVoices')}` : ''}
                  </span>
                </button>
                <button
                  type="button"
                  className="grid size-9 place-items-center rounded-lg text-[15px]"
                  aria-label={favorite ? t('unfavoriteVoice') : t('favoriteVoice')}
                  aria-pressed={favorite}
                  onClick={() =>
                    void onUpdate({
                      favoriteVoiceIds: toggleFavoriteVoice(
                        settings.favoriteVoiceIds,
                        id,
                      ),
                    })
                  }
                >
                  {favorite ? '★' : '☆'}
                </button>
              </div>
            )
          })}
          {filteredVoices.length === 0 && !showSystemDefault && (
            <p className="m-0 px-2 py-3 text-[11px] text-[var(--tr-muted)]">
              {t('noVoicesFound')}
            </p>
          )}
        </div>

        <button
          type="button"
          disabled={!previewPlaying && (!previewVoice || previewDisabled)}
          className="mt-2 h-9 w-full rounded-lg bg-[var(--tr-soft)] text-[11px] font-semibold disabled:opacity-45"
          aria-pressed={previewPlaying}
          onClick={() => {
            if (previewPlaying) onStopPreview()
            else if (previewVoice) onPreview(previewVoice, previewLanguage)
          }}
        >
          {t(previewPlaying ? 'stopPreview' : 'previewVoice')}
        </button>
      </section>

      <section>
        <span className="mb-2 block text-[12px] font-semibold">{t('presets')}</span>
        <div className="flex gap-2">
          <input
            type="text"
            maxLength={60}
            className="h-9 min-w-0 flex-1 rounded-lg border border-[var(--tr-border)] bg-[var(--tr-surface-strong)] px-2.5 text-[12px]"
            placeholder={t('presetName')}
            value={presetName}
            onChange={(event) => setPresetName(event.target.value)}
          />
          <button
            type="button"
            disabled={!presetName.trim()}
            className="rounded-lg bg-[var(--tr-accent)] px-3 text-[11px] font-semibold text-[var(--tr-accent-text)] disabled:opacity-45"
            onClick={() => void savePreset()}
          >
            {t('savePreset')}
          </button>
        </div>
        {settings.voicePresets.length > 0 && (
          <div className="mt-2 space-y-1">
            {settings.voicePresets.map((preset) => (
              <div
                key={preset.id}
                className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-1 rounded-lg bg-[var(--tr-soft)] px-2 py-1.5"
              >
                <div className="min-w-0">
                  <span className="block truncate text-[11px] font-medium">
                    {preset.name}
                  </span>
                  <span className="block truncate text-[10px] text-[var(--tr-muted)]">
                    {preset.voiceId
                      ? (voices.find(
                          (voice) =>
                            idOf(voice) === preset.voiceId ||
                            voice.name === preset.voiceId,
                        )?.name ?? t('unavailableSavedVoice'))
                      : t('systemDefault')}
                    {` · ${preset.speed.toFixed(2)}×`}
                  </span>
                </div>
                <button
                  type="button"
                  className="h-8 rounded-md px-2 text-[11px] font-semibold"
                  onClick={() => void applyPreset(preset)}
                >
                  {t('applyPreset')}
                </button>
                <button
                  type="button"
                  className="h-8 rounded-md px-2 text-[11px] text-[var(--tr-muted)]"
                  aria-label={`${t('deletePreset')} ${preset.name}`}
                  onClick={() =>
                    void onUpdate({
                      voicePresets: removeVoicePreset(settings.voicePresets, preset.id),
                    })
                  }
                >
                  {t('deletePreset')}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="rounded-lg bg-[var(--tr-soft)] px-3 py-2 text-[10px] leading-4 text-[var(--tr-muted)]">
        <p className="m-0">{t('localVoicePrivacy')}</p>
        <p className="mb-0 mt-1">{t('voiceCloneUnavailable')}</p>
      </div>
    </div>
  )
}
