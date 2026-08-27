# TextReader 1.1.4

Released on August 28, 2026.

TextReader 1.1.4 protects rapid voice personalization and settings interactions from stale UI state after a full UI, UX, motion, and audio-lifecycle audit.

## Highlights

- Added a view-level settings queue that computes each queued change from the latest successful settings, preventing rapid favorites, recent voices, per-language mappings, presets, and repeated switches from overwriting earlier interactions.
- Kept queued updates moving after a failed write and immediately synchronized successful Side Panel and Options changes, while preventing an older Options save-status timer from hiding newer feedback.
- Preserved exact locale-aware voice identities throughout rapid updates and added persistent localized accessible names to voice search and preset-name inputs.
- Rechecked compact and wide layouts, themes, reduced motion, multilingual voice controls, preview/playback isolation, accessibility feedback, production resources, and audio ownership.

TextReader continues to use browser/OS Web Speech only. SFX and BGM remain intentionally absent because notification sounds and background music would compete with spoken content. No remote audio, tracking, client-side credentials, or third-party secrets were added.

## Verification

- 34 automated test files with 162 passing tests, including rapid favorites, per-language mappings, repeated switches, failed-write recovery, exact locale identity, and accessible voice-library fields
- ESLint, full-workspace TypeScript, production build, formatting, production dependency audit, diff validation, version consistency, extension-resource integrity, and sensitive-data checks
- Isolated production-bundle UI checks for Popup, Side Panel, Options, 280 × 400 and 400 × 700 layouts, reduced-motion behavior, horizontal overflow, accessible controls, and product console errors

Previous announcement: [TextReader 1.1.3](./docs/announcements/history/1.1.3.md).
