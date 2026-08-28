# TextReader 1.1.6

Released on August 28, 2026.

TextReader 1.1.6 improves settings recovery, tab-title accuracy, dark-theme controls, and voice-mapping transparency after a full UI, UX, motion, and audio-lifecycle audit.

## Highlights

- Distinguished initial settings-load failures from save failures and restored the normal Options status when a later valid storage update arrives.
- Prevented title updates from the previous tab from overwriting the active Side Panel title after activation, and added a localized fallback for empty page titles.
- Restored clear checked-switch contrast in dark mode across Popup, Options, and Voice Library while preserving the existing light theme.
- Kept unavailable saved per-language voices visible as disabled mappings so users can deliberately choose automatic mode or a replacement voice.
- Added a localized confirmation before resetting settings, voice favorites, and presets, preventing accidental loss of personalization.
- Rechecked compact and wide layouts, four interface languages, themes, reduced motion, voice controls, destructive actions, production resources, and audio ownership.

TextReader continues to use browser/OS Web Speech only. SFX and BGM remain intentionally absent because notification sounds and background music would compete with spoken content. No remote audio, tracking, client-side credentials, or third-party secrets were added.

## Verification

- 34 automated test files with 174 passing tests, including settings error recovery, tab-title races, unavailable voice mappings, switch contrast, and reset confirmation
- ESLint, full-workspace TypeScript, production build, formatting, production dependency audit, diff validation, version consistency, extension-resource integrity, and sensitive-data checks
- Isolated production-bundle UI checks for Popup, Side Panel, and Options across 280 × 400 through 800 × 800 layouts, all four interface languages, both themes, reduced motion, horizontal overflow, unavailable voice feedback, reset confirmation, and product console errors

Previous announcement: [TextReader 1.1.5](./docs/announcements/history/1.1.5.md).
