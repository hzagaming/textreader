import { useEffect, useRef, useState } from 'react'
import type { ReaderSettings, ThemePreference } from '@textreader/shared'
import { Logo } from '@/components/logo'
import { DEFAULT_SETTINGS, settingsService } from '@/services/settings/settings'

export function OptionsApp() {
  const [settings, setSettings] = useState<ReaderSettings>(DEFAULT_SETTINGS)
  const [saveState, setSaveState] = useState<'idle' | 'saved' | 'error'>('idle')
  const statusTimer = useRef<number | undefined>(undefined)
  const version = chrome.runtime.getManifest().version

  useEffect(() => {
    void settingsService
      .get()
      .then(setSettings)
      .catch(() => setSaveState('error'))
    const unsubscribe = settingsService.subscribe(setSettings)
    return () => {
      unsubscribe()
      if (statusTimer.current !== undefined) window.clearTimeout(statusTimer.current)
    }
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme
  }, [settings.theme])

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

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-5 py-10">
      <header className="mb-7 flex items-end justify-between">
        <div>
          <Logo />
          <h1 className="mb-0 mt-4 text-2xl font-semibold tracking-[-0.03em]">
            Settings
          </h1>
        </div>
        <span
          className="text-[12px] text-[var(--tr-muted)]"
          role={saveState === 'error' ? 'alert' : 'status'}
          aria-live="polite"
        >
          {saveState === 'saved'
            ? 'Saved'
            : saveState === 'error'
              ? 'Unable to save'
              : `v${version}`}
        </span>
      </header>
      <div className="space-y-4">
        <section className="rounded-[18px] border border-[var(--tr-border)] bg-[var(--tr-surface)] p-5">
          <h2 className="m-0 text-[14px] font-semibold">Selection</h2>
          <div className="mt-4 flex items-center justify-between">
            <div>
              <p className="m-0 text-[13px] font-medium">Floating read button</p>
              <p className="mb-0 mt-1 text-[12px] text-[var(--tr-muted)]">
                Show the speaker after selecting meaningful text.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.autoShowSelectionButton}
              aria-label="Show floating read button"
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
          <h2 className="m-0 text-[14px] font-semibold">Reading</h2>
          <label className="mt-4 block text-[12px] font-medium">
            Webpage highlight
            <select
              className="mt-2 h-10 w-full rounded-xl border border-[var(--tr-border)] bg-[var(--tr-surface-strong)] px-3 text-[13px]"
              value={settings.highlightMode}
              onChange={(event) =>
                void update({
                  highlightMode: event.target.value as ReaderSettings['highlightMode'],
                })
              }
            >
              <option value="off">Off</option>
              <option value="sentence">Current sentence</option>
              <option value="paragraph">Current paragraph</option>
            </select>
          </label>
        </section>
        <section className="rounded-[18px] border border-[var(--tr-border)] bg-[var(--tr-surface)] p-5">
          <h2 className="m-0 text-[14px] font-semibold">Appearance</h2>
          <label className="mt-4 block text-[12px] font-medium">
            Theme
            <select
              className="mt-2 h-10 w-full rounded-xl border border-[var(--tr-border)] bg-[var(--tr-surface-strong)] px-3 text-[13px]"
              value={settings.theme}
              onChange={(event) =>
                void update({ theme: event.target.value as ThemePreference })
              }
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
        </section>
        <section className="rounded-[18px] border border-[var(--tr-border)] bg-[var(--tr-surface)] p-5">
          <h2 className="m-0 text-[14px] font-semibold">Keyboard shortcuts</h2>
          <dl className="mb-0 mt-4 grid grid-cols-[1fr_auto] gap-y-3 text-[12px]">
            <dt>Open Reader / read selection</dt>
            <dd className="m-0 rounded-md bg-[var(--tr-soft)] px-2 py-1 font-mono">
              Alt + R
            </dd>
            <dt>Stop reading</dt>
            <dd className="m-0 rounded-md bg-[var(--tr-soft)] px-2 py-1 font-mono">
              Alt + Shift + R
            </dd>
          </dl>
          <button
            type="button"
            className="mt-4 text-[12px] font-semibold underline underline-offset-4"
            onClick={() =>
              void chrome.tabs.create({ url: 'chrome://extensions/shortcuts' })
            }
          >
            Manage browser shortcuts
          </button>
        </section>
        <button
          type="button"
          className="h-10 rounded-xl border border-[var(--tr-border)] bg-[var(--tr-surface)] px-4 text-[12px] font-medium"
          onClick={() => void update(DEFAULT_SETTINGS)}
        >
          Reset settings
        </button>
      </div>
    </main>
  )
}
