# TextReader 0.3.4

Released on August 21, 2026.

TextReader 0.3.4 is a voice-selection, accessibility, and cross-browser reliability release backed by a full extension audit.

## Highlights

- Added direct preview controls to every system voice without changing the saved selection, with exact voice-and-locale labels for preview and favorite actions.
- Made automatic voice selection prefer the requested locale, such as `en-US` or `zh-CN`, before falling back to another voice in the same base language.
- Changed previews to use the same per-sentence segmentation and Natural expression rules as article playback, and removed the active-page response wait from preview startup.
- Hardened preview cleanup when stopping, switching voices, closing voice settings, opening Options, using global commands, or reaching natural completion.
- Prevented Side Panel reader shortcuts from taking over the voice-settings workspace; while a preview is active, Space stops only that preview.
- Disabled the Popup selection switch until its stored value is loaded, avoiding an early-interaction race, and routed shortcut management to the native `chrome://` or `edge://` page.
- Kept future remote-TTS chunks on grapheme boundaries so emoji and joined characters are not split, and corrected Korean speech-duration estimates.

Natural expression remains a subtle adjustment of standardized Web Speech rate, pitch, and volume. Its audible result depends on the installed browser/OS voice. This release does not add neural emotion, voice cloning, a remote TTS provider, SFX, BGM, tracking, credentials, or third-party secrets.

## Verification

- 32 automated test files with 133 passing tests covering direct voice preview, locale fallback, preview lifecycle, settings keyboard isolation, Popup initialization, Chrome/Edge shortcut routing, grapheme-safe chunking, and Korean duration estimates
- ESLint, full-workspace TypeScript, production build, formatting, production dependency audit, diff validation, version consistency, and sensitive-data checks
- Isolated Chromium checks across Chinese, English, Japanese, and Korean interfaces, light/dark themes, 280 × 400 and 400 × 700 Side Panels, Popup and narrow Options layouts, direct-preview storage isolation, keyboard behavior, console errors, and selected-text control latency

Previous announcement: [TextReader 0.3.3](./docs/announcements/history/0.3.3.md).
