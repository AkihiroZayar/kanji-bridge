<p align="center">
  <img src="app-icon.png" alt="Kanji Bridge logo" width="112">
</p>

<h1 align="center">Kanji Bridge 漢字ブリッジ</h1>

<p align="center">
  Paste any Japanese text and get hiragana furigana above every kanji — then export it as a PDF.<br>Free, runs in your browser. By AkihiroLabs.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.1.0-1E3A8A" alt="version 1.1.0">
  <img src="https://img.shields.io/badge/vanilla-JavaScript-00A8CC" alt="Vanilla JS">
  <img src="https://img.shields.io/badge/powered%20by-Kuromoji-1E3A8A" alt="Kuromoji">
</p>

---

## ✨ Features

- **Furigana generator** — hiragana readings above each kanji, powered by the Kuromoji morphological analyzer
- **Works on any Japanese text** — paste a sentence, paragraph or article
- **Example texts** — one-click samples (server settings, cloud, machine learning, security…)
- **PDF export** — download your text with furigana as a PDF
- **History** — your last paragraphs are saved and can be reloaded or exported
- **Free** — no account, no limits

## 🚀 Getting started

No build step is needed.

1. Download or clone this repository.
2. Open `index.html` in any modern browser.

Live: **https://akihirozayar.github.io/kanji-bridge/**

## 📁 Project structure

```
kanji-bridge/
├── index.html        # Page markup — links the CSS and JS
├── css/
│   └── style.css     # Styles
├── js/
│   ├── version.js    # APP_VERSION
│   └── app.js        # Tokenizer, furigana, history, PDF export
├── app-icon.png        # App logo (README, 512px)
├── favicon.png · apple-touch-icon.png · icon-192.png · icon-512.png
├── CHANGELOG.md
└── README.md
```

> ℹ️ The first time you open the app it downloads the Japanese dictionary (about 7 MB). After that it's cached by your browser.

## 🛠 Tech

- Vanilla JavaScript, HTML and CSS — no frameworks, no build tools
- [Kuromoji](https://github.com/takuyaa/kuromoji.js) for Japanese tokenization and readings
- [jsPDF](https://github.com/parallax/jsPDF) + [html2canvas](https://github.com/niklasvh/html2canvas) for PDF export
- Google Fonts (Noto Sans JP, Noto Serif JP, Inter)

## 🔖 Versioning

This project uses [Semantic Versioning](https://semver.org/) (`MAJOR.MINOR.PATCH`).

- The version lives in **`js/version.js`** (`APP_VERSION`).
- To release: bump the version, add an entry to [`CHANGELOG.md`](CHANGELOG.md), then create a GitHub Release tagged `vX.Y.Z`.

Current version: **v1.1.0** — see the [changelog](CHANGELOG.md).

## 💬 Community

Updates and feedback on the **AkihiroLabs Discord server**.

---

<p align="center">
  Built with 🦝 by <b>AkihiroLabs</b>
</p>
