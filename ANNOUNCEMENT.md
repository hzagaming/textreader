# TextReader 1.1.3

Released on August 27, 2026.

TextReader 1.1.3 makes multilingual voice choices exact and strengthens settings and Side Panel recovery after another full UI, UX, motion, and audio-lifecycle audit.

## Highlights

- Persisted browser voices with a locale-aware identity, so voices that share a URI or name can now be selected independently across the library, per-language mappings, favorites, recent voices, presets, previews, and actual reading playback.
- Kept existing URI/name voice choices readable while converting user interactions to the exact identity, and added locale labels to regional voice mappings and saved presets so similar voices remain distinguishable.
- Made settings reads side-effect-free, preventing a stale migration write from Popup, Side Panel, or Options from racing with and overwriting a newer background-serialized update. The update queue also remains usable after a storage failure.
- Refreshed reader state whenever the Side Panel recovers from an initially failed Background port connection, closing a stale-state gap during extension startup.
- Rechecked compact and wide layouts, themes, reduced motion, multilingual controls, regional voice lists, preview/playback isolation, accessibility feedback, production resources, and audio ownership.

TextReader continues to use browser/OS Web Speech only. SFX and BGM remain intentionally absent because notification sounds and background music would compete with spoken content. No remote audio, tracking, client-side credentials, or third-party secrets were added.

## Verification

- 33 automated test files with 157 passing tests, including colliding voice IDs, regional mappings, exact playback selection, read-only settings migration, failed-write recovery, and initial connection recovery
- ESLint, full-workspace TypeScript, production build, formatting, production dependency audit, diff validation, version consistency, extension-resource integrity, and sensitive-data checks
- Isolated production-bundle UI checks for Popup, Side Panel, Options, 280- and 400-pixel Side Panel widths, regional voice labels, reduced-motion behavior, overflow, and accessibility state

Previous announcement: [TextReader 1.1.2](./docs/announcements/history/1.1.2.md).
