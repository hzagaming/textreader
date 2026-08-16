# TextReader 0.2.1

Released on August 17, 2026.

TextReader 0.2.1 is a Phase 2 reliability, accessibility, and interaction-quality release for Chrome and Microsoft Edge.

## Highlights

- Fixed page and Side Panel keyboard controls across playing, paused, stopped, completed, and unsupported-page states.
- Prevented reader shortcuts from overriding focused buttons, links, form fields, and editable regions.
- Fixed stale reader content when changing tabs and kept article titles visible during initial Side Panel loading.
- Preserved legitimate repeated paragraphs during extraction and hardened message and TTS index validation.
- Prevented stale TTS completion events during sentence jumps.
- Serialized rapid settings updates and made multi-tab reading-progress storage resistant to concurrent-write loss.
- Added visible save/open errors and improved switches, sliders, progress, live status, focus, disabled-state, narrow-view, and reduced-motion behavior.

This release remains fully local: it uses the browser's Web Speech API and does not add remote TTS, SFX, BGM, tracking, or third-party secrets.

## Verification

- 19 automated test files with 55 passing tests
- ESLint, TypeScript, production build, formatting, dependency audit, and sensitive-data checks
- Real Chromium checks at Popup, Options, and 280 px Side Panel sizes, including dark theme, reduced motion, tab switching, article extraction, playback controls, and browser-restricted pages

Previous announcement: [TextReader 0.2.0](./docs/announcements/history/0.2.0.md).
