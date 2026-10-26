# Changelog

All notable changes to **Kanji Bridge 漢字ブリッジ** are documented here.
This project follows [Semantic Versioning](https://semver.org/).

## [1.4.0] — 2026-10-26

- **Clearer, step-by-step UI** built for general Japanese learners: ① paste text → ② add furigana → ③ result.
- **Hero shows what furigana is** with a live sample sentence (日本語を勉強するのは楽しい).
- **New example texts by JLPT level** (N5–N1): self-introduction, weather, shopping, diary, station announcement, work email, news, novel — replacing the IT-only examples.
- **No more blocking loading screen** — the dictionary loads in the background with a small progress bar, and you can type straight away.
- **Result card appears only when there is a result**, styled like paper, with Hide/Show furigana, text size, Copy (plain text) and Save PDF.
- **Language switch: English / 日本語 / မြန်မာ** (remembered on this device; new `js/i18n.js`).
- App logo now shown in the header and footer; emoji replaced with line icons.
- Ctrl/⌘ + Enter adds furigana; character counter and Clear button on the input.
- Recent texts redesigned as a simple list with Open and PDF buttons.
- Service worker cache bumped to `kanji-bridge-v2`.

## [1.3.0] — 2026-10-26

- **Installable app (PWA).** An *Install* button appears in the top bar when your browser supports it.
- **Dictionary is cached** — the ~7MB Japanese dictionary downloads once, then loads instantly and works offline.
- Now hosted on Cloudflare at **https://kanji.akihirolabs.com** (moved from GitHub Pages).

## [1.2.0] — 2026-10-01

- Redesigned the UI for a simpler, tool-first layout: dropped the hero section and feature cards, so the furigana tool is visible immediately below a one-line intro.
- Restyled to the AkihiroLabs brand (navy #1E3A8A, white, charcoal) in place of the previous purple theme.
- Replaced the large "dictionary ready" banner with a small status dot.
- Added an output toolbar: furigana on/off toggle, A−/A+ font size control, Copy, and PDF export.
- Recent paragraphs history is now collapsed by default to reduce visual clutter.
- Added an AkihiroLabs Discord banner above the footer.
- Rebranded the exported PDF with a navy header (logo + AkihiroLabs label) and a footer with the Discord link.
- Footer restyled to a light theme matching the rest of the page.

## [1.1.0] — 2026-09-29

- New app logo in the AkihiroLabs family style (navy base, white symbol, vermilion accent): `app-icon.png`, `favicon.png`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`.
- The page now has a favicon and a home-screen icon.

## [1.0.0] — 2026-09-28

- Split the single-file `index.html` into `index.html`, `css/style.css` and `js/app.js`.
- Added `js/version.js`, `README.md` and `CHANGELOG.md`.
- Repository renamed from `Kanji-Bridge-By-Akihiro` to `kanji-bridge`.
- No feature or behavior changes.
