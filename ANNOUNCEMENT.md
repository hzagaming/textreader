# TextReader 0.2.2

Released on August 17, 2026.

TextReader 0.2.2 is a Phase 2 stability, responsiveness, and reading-continuity release for Chrome and Microsoft Edge.

## Highlights

- Re-synchronized the Side Panel after service-worker or Port reconnection so playback state cannot remain stale.
- Prevented older article/page/selection requests and TTS callbacks from overwriting the newest reading action.
- Made loading cancellable and disabled conflicting controls, navigation, and shortcuts until playback is ready.
- Fixed hidden, zero-size, ignored-field, click, and viewport-edge states for the selection menu, plus nested-list duplicate speech.
- Hardened tab queries and malformed runtime responses, and safely handled background-menu and progress-save failures.
- Kept reader state and titles isolated to the correct browser window, exposed unavailable saved voices and asynchronous TTS errors, and protected rapid setting toggles.
- Improved light-theme contrast and removed an unnecessary full-page text scan plus unused message paths.

This release remains fully local: it uses the browser's Web Speech API and does not add remote TTS, SFX, BGM, tracking, or third-party secrets.

## Verification

- 21 automated test files with 66 passing tests
- ESLint, TypeScript, production build, formatting, dependency audit, and sensitive-data checks
- Real Chromium checks across Popup, Options, and narrow/short Side Panel sizes, including race handling, reduced motion, title changes, nested lists, service-worker reconnection, playback recovery, and browser-restricted pages

Previous announcement: [TextReader 0.2.1](./docs/announcements/history/0.2.1.md).
