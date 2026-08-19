# TextReader

TextReader is a Chrome and Microsoft Edge extension that reads selected text, extracted articles, or all readable page text with customizable browser and operating-system voices.

This repository contains **Phase 1 and Phase 2**, plus the v0.3 multilingual system-voice library. Remote AI voices and streaming audio belong to Phase 3 and are intentionally not included yet.

## Release announcements

- Current: [TextReader 0.3.3](./ANNOUNCEMENT.md)
- History: [TextReader 0.3.2](./docs/announcements/history/0.3.2.md), [TextReader 0.3.1](./docs/announcements/history/0.3.1.md), [TextReader 0.3.0](./docs/announcements/history/0.3.0.md), [TextReader 0.2.2](./docs/announcements/history/0.2.2.md), [TextReader 0.2.1](./docs/announcements/history/0.2.1.md), [TextReader 0.2.0](./docs/announcements/history/0.2.0.md)

## Features

- Manifest V3 extension for Chrome 116+ and current Microsoft Edge
- Meaningful selection detection with a Shadow DOM floating read button
- Ctrl+A-aware selection menu offering **Read selection** and **Read article** without blocking the webpage shortcut
- Mozilla Readability article extraction from a cloned document
- Fallback extraction through `article`, `main`, largest text container, and cleaned body text
- Selection, Article, and Page reading modes
- Chinese, English, Japanese, and Korean interfaces and extension metadata
- Resilient multilingual sentence segmentation with protected URLs, email addresses, contextual abbreviations, decimals, paragraph boundaries, quotes, and grapheme-safe long clauses
- Sentence queue with previous/next, paragraph navigation, restart, and direct jumps
- 200–500-character speech chunk preparation for future remote TTS providers
- Web Speech API playback with automatic per-language voice switching and voice, speed, pitch, volume, and optional sentence-aware Natural expression controls
- Searchable voice library with language filters, favorites, recent voices, availability feedback, and on-device/network-use labels
- Interface-aware expressive voice previews and custom voice-setting presets
- Side Panel article reader with current-sentence tracking and viewport-aware panel scrolling
- Non-destructive CSS Custom Highlight API integration with a reversible span fallback
- Sentence, paragraph, or disabled webpage highlighting
- Concurrent-safe per-URL reading progress with **Continue** and **Start over** actions
- Estimated reading duration based on text and speech speed
- Popup, options page, context menus, and persistent settings
- Tab activation/reload refresh so the Side Panel does not retain another tab's document
- Keyboard navigation while TextReader is active:
  - `Space`: pause/resume
  - `ArrowLeft` / `ArrowRight`: previous/next sentence
  - `Shift + ArrowLeft` / `Shift + ArrowRight`: previous/next paragraph
  - `Alt + R`: open/read the current selection
  - `Alt + Shift + R`: stop

## Architecture

```text
textreader/
├── extension/
│   ├── public/icons/          # Original SVG source and exported PNG icons
│   ├── src/
│   │   ├── background/        # Context menus, commands, Side Panel opening
│   │   ├── components/        # Shared React UI
│   │   ├── content/           # Selection, page controller, floating menu
│   │   ├── hooks/             # Side Panel/tab connection lifecycle
│   │   ├── options/           # Settings page
│   │   ├── popup/             # Toolbar popup
│   │   ├── services/
│   │   │   ├── article/       # Readability and extraction fallbacks
│   │   │   ├── highlight/     # Range lookup and webpage highlighting
│   │   │   ├── i18n/          # Four-language application translations
│   │   │   ├── language/      # Language detection and normalization
│   │   │   ├── messaging/     # Typed extension protocol
│   │   │   ├── progress/      # Per-URL reading progress
│   │   │   ├── reader/        # Documents, queue, and speech chunks
│   │   │   ├── settings/      # Versioned local settings
│   │   │   └── tts/           # Browser TTS and segmentation
│   │   ├── sidepanel/         # Article reader and controls
│   │   ├── stores/            # Zustand reader/document state
│   │   ├── styles/            # Tailwind and theme tokens
│   │   └── types/             # Extension errors
│   ├── manifest.json
│   └── vite.config.ts
├── server/                    # Reserved workspace; server starts in Phase 3
├── shared/types/              # Cross-workspace reader and TTS contracts
└── package.json               # npm workspaces and root commands
```

Readability always receives a cloned document. Browser TTS runs in the content script because a Manifest V3 service worker has no `window` or `speechSynthesis`. Reader state messages contain only the current sentence; full documents are transferred separately to avoid repeatedly sending an entire long article. While the Side Panel is open, the service worker relays tab-scoped state and document updates through a long-lived Port so inactive tabs cannot overwrite the active reader.

## Requirements

- Node.js 22+
- npm 10+
- Chrome 116+ or a current Chromium-based Microsoft Edge

## Development

```bash
npm install
npm run dev
```

The extension output is `extension/dist`. Reload the unpacked extension after changing its manifest, service worker, or content-script entry point.

## Quality checks

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run format:check
```

## Install in Chrome

1. Run `npm install` and `npm run build`.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Choose **Load unpacked**.
5. Select `extension/dist`.

## Install in Microsoft Edge

1. Run `npm install` and `npm run build`.
2. Open `edge://extensions`.
3. Enable **Developer mode**.
4. Choose **Load unpacked**.
5. Select `extension/dist`.

## Manual Phase 2 acceptance

Test on Wikipedia, a Medium-style article, a news site, a blog, a GitHub README page, Chinese text, Japanese text, and one long article.

1. Select a short passage, verify the floating speaker appears immediately, and confirm it starts local speech.
2. Select more than 1,000 characters or use Ctrl+A and verify both selection/article actions appear.
3. Open the Side Panel and choose **Read Article**.
4. Confirm the extracted title, site metadata, and paragraphs are reasonable and navigation/footer text is absent.
5. Verify pause, resume, previous/next sentence, paragraph shortcuts, direct sentence clicks, and stop.
6. Switch highlight settings between Off, Sentence, and Paragraph.
7. Choose **Read Page** and confirm additional body text is included without buttons/forms.
8. Reload a partially read page, reopen TextReader, and verify the continue prompt.
9. Switch tabs and confirm the Side Panel refreshes to the active page rather than showing stale article content.
10. Search and filter voices, select a voice, toggle Natural expression, favorite and preview it, save/apply a preset, and confirm the values persist.
11. Use a mixed Chinese/English/Japanese/Korean page and verify automatic mode selects a matching voice for each sentence when those system voices are installed.

Actual audio output depends on voices installed by the operating system. Automated tests verify extraction, segmentation, queueing, chunking, highlighting fallback, settings migration, and progress validation, but cannot verify speaker hardware or OS voice quality.

## Permissions

- `storage`: save settings and per-URL progress locally
- `activeTab`: address the user-activated page
- `contextMenus`: expose selection reading and Side Panel actions
- `sidePanel`: provide the reader interface
- `http://*/*` and `https://*/*`: detect and extract readable content on ordinary webpages

TextReader does not request access to `file://`, browser-internal pages, or remote TTS hosts.

## Privacy and security

TextReader does not call a TextReader-hosted or third-party TTS API in this release. Page DOM, article text, selections, history, and settings are not uploaded by the extension, and reading progress, favorites, recent voices, and presets remain in `chrome.storage.local`. Web Speech playback is provided by the selected browser/OS voice; voices not marked on-device may use that platform's network service. Password inputs and TextReader's own injected DOM are excluded from selection handling.

## Current limitations

- Extraction quality still depends on each site's markup and dynamic rendering.
- Browser-restricted URLs such as `chrome://`, `edge://`, extension stores, and some built-in PDF viewers cannot run content scripts.
- Webpage highlighting relies on matching extracted normalized text back to live DOM text; heavily transformed or virtualized pages may not expose a matching Range.
- Voice availability, quality, pronunciation, and network behavior vary by browser and operating system.
- Natural expression is a subtle Web Speech prosody adjustment, not a neural emotion model; audible differences vary by installed voice.
- Voice cloning is unavailable until an authorized server provider, explicit consent workflow, deletion controls, and abuse protections exist.
- AI voices, remote providers, streaming audio, request cancellation, and paid-audio caching start in Phase 3.
- The server workspace is intentionally inactive until Phase 3.
- The icons are original temporary assets rather than a finalized brand identity.

## Roadmap

- Phase 3: secure server-side AI TTS providers and streaming audio
- Phase 4: provider-aware Voice Studio, advanced presets, timing, and word highlighting
- Phase 5: history, library, privacy controls, performance, and store readiness
