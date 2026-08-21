# TextReader 0.3.5

Released on August 22, 2026.

TextReader 0.3.5 is a focused reliability follow-up for Popup initialization, locale-specific voice previews, and grapheme-safe future TTS streaming.

## Highlights

- Made Popup initialization settle tab, settings, and reader-state requests independently. A failed tab lookup no longer discards a successfully loaded selection preference, and a settings failure keeps the switch safely disabled.
- Made direct-preview playback state unique to both the system voice ID and locale, so same-ID voices for different locales no longer display multiple active stop controls.
- Extended grapheme-safe future remote-TTS chunking to unspaced Hangul, emoji, regional indicators, combining marks, and joined sequences while preserving indivisible Latin words.
- Rechecked Side Panel, Popup, Options, selection controls, browser TTS lifecycle, accessibility names, responsive layouts, themes, localization, audio paths, and production bundles.

Natural expression remains a subtle adjustment of standardized Web Speech rate, pitch, and volume. Its audible result depends on the installed browser/OS voice. This release does not add neural emotion, voice cloning, a remote TTS provider, SFX, BGM, tracking, credentials, or third-party secrets.

## Verification

- 32 automated test files with 138 passing tests covering partial Popup initialization, locale-unique preview state, grapheme-safe Hangul and emoji chunking, and the existing reading, settings, extraction, highlighting, and messaging behavior
- ESLint, full-workspace TypeScript, production build, formatting, production dependency audit, diff validation, version consistency, and sensitive-data checks
- Isolated Chromium checks across Chinese, English, Japanese, and Korean interfaces; light/dark themes; compact and tall Side Panels; narrow and wide Popup/Options layouts; Popup failure states; duplicate-locale voice previews; overflow, accessibility, console, and page errors

Previous announcement: [TextReader 0.3.4](./docs/announcements/history/0.3.4.md).
