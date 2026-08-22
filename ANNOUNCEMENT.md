# TextReader 1.1.0

Released on August 23, 2026.

TextReader 1.1.0 is a UI, interaction, and audio-lifecycle reliability release backed by a fresh production-extension audit.

## Highlights

- Reworked speed, pitch, and volume sliders to update visually during a drag while persisting only once when the interaction finishes. This removes queued storage writes and value rollback during rapid adjustments; failed saves now restore the actual persisted value.
- Made the Popup surface content-connection failures directly instead of presenting restricted pages as ready to read.
- Prevented stale active-tab title requests from overwriting the newest Side Panel page title during rapid tab changes.
- Removed unused Vite module preloads that caused cross-world extension warnings and redundant local resource requests in production Chromium pages.
- Rechecked selection latency, password-field isolation, browser TTS and preview cleanup, themes, four interface languages, compact layouts, accessibility names, overflow, and production audio/security paths.

TextReader continues to use browser/OS Web Speech only. SFX and BGM remain intentionally absent because notification sounds and background music would compete with spoken content. This release does not add neural emotion, voice cloning, remote TTS, tracking, client-side credentials, or third-party secrets.

## Verification

- 33 automated test files with 142 passing tests covering slider commit and failure recovery, Popup connection errors, active-tab title ordering, and the existing extraction, reading, voice, highlight, settings, and messaging behavior
- ESLint, full-workspace TypeScript, production build, formatting, production dependency audit, diff validation, version consistency, extension-resource integrity, and sensitive-data checks
- Isolated Microsoft Edge production-extension checks across Chinese, English, Japanese, and Korean interfaces; light/dark themes; 280 × 400 and 400 × 700 Side Panels; 280-pixel Popup/Options layouts; slider persistence; restricted-page errors; accessibility names; and horizontal overflow
- Local-page selection control appeared in about 18 ms without layout shift, remained inside the viewport, and stayed hidden for password-field interaction

Previous announcement: [TextReader 0.3.5](./docs/announcements/history/0.3.5.md).
