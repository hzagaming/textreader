import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReaderSettings, ThemePreference } from '@textreader/shared'
import { Logo } from '@/components/logo'
import { createTranslator, resolveUiLanguage } from '@/services/i18n/i18n'
import { DEFAULT_SETTINGS, settingsService } from '@/services/settings/settings'

export function OptionsApp() {
  const [settings, setSettings] = useState<ReaderSettings>(DEFAULT_SETTINGS)
  const [saveState, setSaveState] = useState<'idle' | 'saved' | 'error'>('idle')
  const [shortcutError, setShortcutError] = useState(false)
  const statusTimer = useRef<number | undefined>(undefined)
  const version = chrome.runtime.getManifest().version
  const t = useMemo(() => createTranslator(settings.uiLanguage), [settings.uiLanguage])

  useEffect(() => {
    let settingsVersion = 0
    const unsubscribe = settingsService.subscribe((nextSettings) => {
      settingsVersion += 1
      setSettings(nextSettings)
    })
    const initialSettingsVersion = settingsVersion
    void settingsService
      .get()
      .then((nextSettings) => {
        if (settingsVersion === initialSettingsVersion) setSettings(nextSettings)
      })
      .catch(() => {
        if (settingsVersion === initialSettingsVersion) setSaveState('error')
      })
    return () => {
      settingsVersion += 1
      unsubscribe()
      if (statusTimer.current !== undefined) window.clearTimeout(statusTimer.current)
    }
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme
    document.documentElement.lang = resolveUiLanguage(settings.uiLanguage)
    document.title = `TextReader · ${t('settingsTitle')}`
  }, [settings.theme, settings.uiLanguage, t])

  const update = async (patch: Partial<Omit<ReaderSettings, 'schemaVersion'>>) => {
    if (statusTimer.current !== undefined) window.clearTimeout(statusTimer.current)
    try {
      const next = await settingsService.update(patch)
      setSettings(next)
      setSaveState('saved')
      statusTimer.current = window.setTimeout(() => setSaveState('idle'), 1200)
    } catch {
      setSaveState('error')
    }
  }

  const openShortcutSettings = async () => {
    try {
      await chrome.tabs.create({ url: 'chrome://extensions/shortcuts' })
      setShortcutError(false)
    } catch {
      setShortcutError(true)
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-5 py-10">
      <header className="mb-7 flex items-end justify-between">
        <div>
          <Logo />
          <h1 className="mb-0 mt-4 text-2xl font-semibold tracking-[-0.03em]">
            {t('settingsTitle')}
          </h1>
        </div>
        <span
          className="text-[12px] text-[var(--tr-muted)]"
          role={saveState === 'error' ? 'alert' : 'status'}
          aria-live="polite"
        >
          {saveState === 'saved'
            ? t('saved')
            : saveState === 'error'
              ? t('unableToSave')
              : `v${version}`}
        </span>
      </header>
      <div className="space-y-4">
        <section className="rounded-[18px] border border-[var(--tr-border)] bg-[var(--tr-surface)] p-5">
          <h2 className="m-0 text-[14px] font-semibold">{t('selectionSection')}</h2>
          <div className="mt-4 flex items-center justify-between">
            <div>
              <p className="m-0 text-[13px] font-medium">{t('floatingReadButton')}</p>
              <p className="mb-0 mt-1 text-[12px] text-[var(--tr-muted)]">
                {t('floatingDescription')}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.autoShowSelectionButton}
              aria-label={t('floatingReadButton')}
              className={`relative h-7 w-12 rounded-full transition ${settings.autoShowSelectionButton ? 'bg-[var(--tr-accent)]' : 'bg-[var(--tr-soft)]'}`}
              onClick={() =>
                void update({
                  autoShowSelectionButton: !settings.autoShowSelectionButton,
                })
              }
            >
              <span
                className={`absolute top-1 size-5 rounded-full bg-white shadow transition ${settings.autoShowSelectionButton ? 'left-6' : 'left-1'}`}
              />
            </button>
          </div>
        </section>
        <section className="rounded-[18px] border border-[var(--tr-border)] bg-[var(--tr-surface)] p-5">
          <h2 className="m-0 text-[14px] font-semibold">{t('readingSection')}</h2>
          <label className="mt-4 block text-[12px] font-medium">
            {t('webpageHighlight')}
            <select
              className="mt-2 h-10 w-full rounded-xl border border-[var(--tr-border)] bg-[var(--tr-surface-strong)] px-3 text-[13px]"
              value={settings.highlightMode}
              onChange={(event) =>
                void update({
                  highlightMode: event.target.value as ReaderSettings['highlightMode'],
                })
              }
            >
              <option value="off">{t('off')}</option>
              <option value="sentence">{t('currentSentence')}</option>
              <option value="paragraph">{t('currentParagraph')}</option>
            </select>
          </label>
          <div className="mt-4 flex items-center justify-between gap-4">
            <div>
              <p className="m-0 text-[13px] font-medium">{t('naturalExpression')}</p>
              <p className="mb-0 mt-1 text-[12px] text-[var(--tr-muted)]">
                {t('naturalExpressionDescription')}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.naturalExpression}
              aria-label={t('naturalExpression')}
              className={`relative h-7 w-12 shrink-0 rounded-full transition ${settings.naturalExpression ? 'bg-[var(--tr-accent)]' : 'bg-[var(--tr-soft)]'}`}
              onClick={() =>
                void update({ naturalExpression: !settings.naturalExpression })
              }
            >
              <span
                className={`absolute top-1 size-5 rounded-full bg-white shadow transition ${settings.naturalExpression ? 'left-6' : 'left-1'}`}
              />
            </button>
          </div>
        </section>
        <section className="rounded-[18px] border border-[var(--tr-border)] bg-[var(--tr-surface)] p-5">
          <h2 className="m-0 text-[14px] font-semibold">{t('appearance')}</h2>
          <label className="mt-4 block text-[12px] font-medium">
            {t('interfaceLanguage')}
            <select
              className="mt-2 h-10 w-full rounded-xl border border-[var(--tr-border)] bg-[var(--tr-surface-strong)] px-3 text-[13px]"
              value={settings.uiLanguage}
              onChange={(event) =>
                void update({
                  uiLanguage: event.target.value as ReaderSettings['uiLanguage'],
                })
              }
            >
              <option value="auto">{t('system')}</option>
              <option value="en">English</option>
              <option value="zh">中文</option>
              <option value="ja">日本語</option>
              <option value="ko">한국어</option>
            </select>
          </label>
          <label className="mt-4 block text-[12px] font-medium">
            {t('theme')}
            <select
              className="mt-2 h-10 w-full rounded-xl border border-[var(--tr-border)] bg-[var(--tr-surface-strong)] px-3 text-[13px]"
              value={settings.theme}
              onChange={(event) =>
                void update({ theme: event.target.value as ThemePreference })
              }
            >
              <option value="system">{t('system')}</option>
              <option value="light">{t('light')}</option>
              <option value="dark">{t('dark')}</option>
            </select>
          </label>
        </section>
        <section className="rounded-[18px] border border-[var(--tr-border)] bg-[var(--tr-surface)] p-5">
          <h2 className="m-0 text-[14px] font-semibold">{t('keyboardShortcuts')}</h2>
          <dl className="mb-0 mt-4 grid grid-cols-[1fr_auto] gap-y-3 text-[12px]">
            <dt>{t('openReaderShortcut')}</dt>
            <dd className="m-0 rounded-md bg-[var(--tr-soft)] px-2 py-1 font-mono">
              Alt + R
            </dd>
            <dt>{t('stopReading')}</dt>
            <dd className="m-0 rounded-md bg-[var(--tr-soft)] px-2 py-1 font-mono">
              Alt + Shift + R
            </dd>
          </dl>
          <button
            type="button"
            className="mt-4 text-[12px] font-semibold underline underline-offset-4"
            onClick={() => void openShortcutSettings()}
          >
            {t('manageShortcuts')}
          </button>
          {shortcutError && (
            <p className="mb-0 mt-2 text-[12px] text-[var(--tr-danger)]" role="alert">
              {t('unableToOpenShortcuts')}
            </p>
          )}
        </section>
        <button
          type="button"
          className="h-10 rounded-xl border border-[var(--tr-border)] bg-[var(--tr-surface)] px-4 text-[12px] font-medium"
          onClick={() => void update(DEFAULT_SETTINGS)}
        >
          {t('resetSettings')}
        </button>
      </div>
    </main>
  )
}
