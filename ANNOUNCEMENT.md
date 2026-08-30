# TextReader 1.1.8

Released on August 30, 2026.

TextReader 1.1.8 protects settings initialization and destructive voice-preset actions after a full UI, UX, motion, and audio-lifecycle audit.

## Highlights

- Kept every Options setting control disabled until the initial local-settings read succeeds, preventing changes based on placeholder defaults.
- Kept Options controls safely disabled after a storage read failure while preserving the existing localized recovery status.
- Added localized confirmation in English, Chinese, Japanese, and Korean before permanently deleting a custom voice preset.
- Preserved a preset when deletion is canceled and removed only the confirmed preset when deletion proceeds.
- Rechecked compact and wide layouts, all interface languages, themes, reduced motion, voice controls, production resources, and audio ownership.

TextReader continues to use browser/OS Web Speech only. SFX and BGM remain intentionally absent because notification sounds and background music would compete with spoken content. No remote audio, tracking, client-side credentials, or third-party secrets were added.

## Verification

- 34 automated test files with 185 passing tests, including Options initialization guards, load-failure protection, and cancel/confirm voice-preset deletion
- ESLint, full-workspace TypeScript, production build, formatting, production dependency audit, diff validation, version consistency, extension-resource integrity, and sensitive-data checks
- Isolated production-bundle UI checks for Options and Side Panel across 280–800 px widths, all four interface languages, themes, reduced motion, horizontal overflow, settings loading, preset deletion confirmation, and product console errors

Previous announcement: [TextReader 1.1.7](./docs/announcements/history/1.1.7.md).
