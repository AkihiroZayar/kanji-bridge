/*!
 * AkihiroLabs — Kanji Bridge — app logic
 * https://github.com/AkihiroZayar/kanji-bridge
 */
(function () {
  "use strict";

  const $ = id => document.getElementById(id);

  /* ── Language ─────────────────────────────────────────────── */
  const LANGS = ["en", "ja", "my"];
  let lang = "en";
  try {
    const saved = localStorage.getItem("kb-lang");
    if (LANGS.includes(saved)) lang = saved;
    else {
      const nav = (navigator.language || "en").slice(0, 2);
      if (nav === "ja") lang = "ja"; else if (nav === "my") lang = "my";
    }
  } catch (e) { /* storage blocked — keep default */ }

  function t(key, vars) {
    let s = (I18N[lang] && I18N[lang][key]) || I18N.en[key] || key;
    if (vars) Object.keys(vars).forEach(k => { s = s.replace("{" + k + "}", vars[k]); });
    return s;
  }

  function applyLang() {
    document.documentElement.lang = lang;
    document.body.classList.toggle("lang-my", lang === "my");
    document.querySelectorAll("[data-i18n]").forEach(el => { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll("[data-lang]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.lang === lang)));
    $("furi-input").placeholder = t("placeholder");
    updateCharCount();
    updateDictUI();
    updateFuriToggle();
    updateResultCount();
    renderHistory();
    if (lastStatusKey) setStatus(lastStatusState, lastStatusKey, lastStatusExtra);
  }

  function setLang(l) {
    lang = l;
    try { localStorage.setItem("kb-lang", l); } catch (e) {}
    applyLang();
  }

  /* ── Web Worker: runs kuromoji off the main thread so browser never freezes ── */
      const WORKER_CODE = `
        importScripts('https://cdn.jsdelivr.net/npm/kuromoji@0.1.2/build/kuromoji.js');
        const DICT = 'https://cdn.jsdelivr.net/npm/kuromoji@0.1.2/dict';
        let tokenizer = null;

        function k2h(str) {
          return str.replace(/[\\u30A1-\\u30F6]/g, ch =>
            String.fromCharCode(ch.charCodeAt(0) - 0x60));
        }

        self.onmessage = function(e) {
          if (e.data.type === 'init') {
            kuromoji.builder({ dicPath: DICT }).build((err, tok) => {
              if (err) { self.postMessage({ type: 'error', msg: err.message }); return; }
              tokenizer = tok;
              self.postMessage({ type: 'ready' });
            });
          } else if (e.data.type === 'tokenize') {
            if (!tokenizer) { self.postMessage({ type: 'error', msg: 'Not ready' }); return; }
            const tokens = tokenizer.tokenize(e.data.text);
            let html = '', count = 0;
            tokens.forEach(token => {
              const surface = token.surface_form;
              const reading = token.reading;
              const hasKanji = /[\\u4E00-\\u9FAF\\u3400-\\u4DBF]/.test(surface);
              if (hasKanji && reading) {
                const hira = k2h(reading);
                if (hira !== surface) {
                  html += '<ruby>' + surface + '<rt>' + hira + '</rt></ruby>';
                  count++;
                  return;
                }
              }
              html += surface.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
            });
            self.postMessage({ type: 'result', html, count });
          }
        };
      `;

  const workerBlob = new Blob([WORKER_CODE], { type: "application/javascript" });
  const worker = new Worker(URL.createObjectURL(workerBlob));

  let dictState = "loading"; // loading | ready | error
  let dictPct = 3;
  let workerReadyResolve = null;
  const workerReadyPromise = new Promise(res => { workerReadyResolve = res; });
  let pendingTokenize = null; // { resolve, reject }

  function updateDictUI() {
    const chip = $("dict-chip");
    chip.className = "dict-chip " + dictState;
    $("dict-chip-text").textContent =
      dictState === "ready" ? t("dictReady") :
      dictState === "error" ? t("dictError") :
      t("dictLoading", { p: dictPct });
    $("dict-bar").style.width = dictPct + "%";
    $("dict-progress").classList.toggle("done", dictState === "ready");
  }

  worker.onmessage = function (e) {
    if (e.data.type === "ready") {
      dictState = "ready"; dictPct = 100;
      updateDictUI();
      workerReadyResolve();
    } else if (e.data.type === "result") {
      if (pendingTokenize) { pendingTokenize.resolve({ html: e.data.html, count: e.data.count }); pendingTokenize = null; }
    } else if (e.data.type === "error") {
      if (dictState !== "ready") { dictState = "error"; updateDictUI(); }
      if (pendingTokenize) { pendingTokenize.reject(new Error(e.data.msg)); pendingTokenize = null; }
    }
  };
  worker.onerror = function () { dictState = "error"; updateDictUI(); };

  function tokenizeAsync(text) {
    return new Promise((resolve, reject) => {
      pendingTokenize = { resolve, reject };
      worker.postMessage({ type: "tokenize", text });
    });
  }

  // Cosmetic progress (kuromoji gives no real progress events)
  [[15, 400], [30, 1200], [50, 2800], [70, 4500], [85, 6500], [92, 9000]].forEach(([pct, delay]) => {
    setTimeout(() => { if (dictState === "loading") { dictPct = pct; updateDictUI(); } }, delay);
  });

  /* ── Input ────────────────────────────────────────────────── */
  function updateCharCount() {
    const n = $("furi-input").value.length;
    $("char-count").textContent = t("chars", { n });
    $("clear-input").hidden = n === 0;
  }

  function renderChips() {
    $("chips").innerHTML = EXAMPLES.map((ex, i) =>
      `<button type="button" class="chip" data-ex="${i}"><span class="lvl lvl-${ex.level.toLowerCase()}">${ex.level}</span>${ex.name}</button>`
    ).join("");
  }

  function setEx(i) {
    const input = $("furi-input");
    input.value = EXAMPLES[i].text;
    updateCharCount();
    clearStatus();
    input.focus();
  }

  /* ── Status line ──────────────────────────────────────────── */
  let lastStatusKey = null, lastStatusState = "", lastStatusExtra = "";
  function setStatus(state, key, extra) {
    lastStatusKey = key; lastStatusState = state; lastStatusExtra = extra || "";
    const el = $("furi-status");
    el.className = "status-line show " + state;
    el.textContent = t(key) + (extra || "");
  }
  function clearStatus() {
    lastStatusKey = null;
    $("furi-status").className = "status-line";
    $("furi-status").textContent = "";
  }

  /* ── Result controls: font size + furigana visibility + copy ── */
  let fontScale = 100; // percent, relative to base size
  const FONT_MIN = 70, FONT_MAX = 170, FONT_STEP = 10;
  let furiganaVisible = true;
  let resultCount = 0;

  function changeFontSize(dir) {
    fontScale = Math.min(FONT_MAX, Math.max(FONT_MIN, fontScale + dir * FONT_STEP));
    $("furi-out").style.fontSize = (fontScale / 100) + "em";
    $("font-size-label").textContent = fontScale + "%";
  }

  function updateFuriToggle() {
    const btn = $("furigana-toggle-btn");
    btn.setAttribute("aria-pressed", String(furiganaVisible));
    btn.querySelector("use").setAttribute("href", furiganaVisible ? "#i-eye-off" : "#i-eye");
    btn.querySelector("span").textContent = t(furiganaVisible ? "hideFuri" : "showFuri");
    $("furi-out").classList.toggle("hide-furigana", !furiganaVisible);
  }

  function toggleFuriganaVisibility() {
    furiganaVisible = !furiganaVisible;
    updateFuriToggle();
  }

  function updateResultCount() {
    $("result-count").textContent = resultCount === 1 ? t("count1") : t("count", { n: resultCount });
  }

  function flashButton(btn, icon, key, ms) {
    const use = btn.querySelector("use"), span = btn.querySelector("span");
    const origIcon = use.getAttribute("href"), origKey = span.dataset.i18n;
    use.setAttribute("href", icon); span.textContent = t(key); btn.classList.add("ok");
    setTimeout(() => { use.setAttribute("href", origIcon); span.textContent = t(origKey); btn.classList.remove("ok"); }, ms);
  }

  async function copyResult() {
    const out = $("furi-out");
    // Copy the plain text (without readings)
    const clone = out.cloneNode(true);
    clone.querySelectorAll("rt").forEach(rt => rt.remove());
    try {
      await navigator.clipboard.writeText(clone.textContent);
      flashButton($("copy-btn"), "#i-check", "copied", 1500);
    } catch (e) {
      alert(t("copyFail"));
    }
  }

  function showResult(html, count) {
    $("furi-out").innerHTML = html || `<span class="furigana-placeholder">${t("noText")}</span>`;
    resultCount = count;
    updateResultCount();
    const card = $("result-card");
    const wasHidden = card.hidden;
    card.hidden = false;
    if (wasHidden) card.classList.add("enter");
    card.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /* ── History ─────────────────────────────────────────────── */
  const MAX_HISTORY = 3;
  let history = []; // [{text, html, count, time}]

  function timeLabel() {
    return new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
  }

  function addToHistory(text, html, count) {
    if (history.length > 0 && history[0].text === text) return;
    history.unshift({ text, html, count, time: timeLabel() });
    if (history.length > MAX_HISTORY) history = history.slice(0, MAX_HISTORY);
    renderHistory();
  }

  function escapeHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function renderHistory() {
    const list = $("history-list");
    $("history-count").textContent = history.length;
    $("clear-history").hidden = history.length === 0;
    if (history.length === 0) {
      list.innerHTML = `<p class="history-empty">${t("recentEmpty")}</p>`;
      return;
    }
    list.innerHTML = history.map((item, i) => `
      <div class="history-item">
        <div class="history-text">
          <span class="history-preview">${escapeHtml(item.text.slice(0, 70))}${item.text.length > 70 ? "…" : ""}</span>
          <span class="history-meta">${item.time} · ${item.count === 1 ? t("count1") : t("count", { n: item.count })}</span>
        </div>
        <div class="history-actions">
          <button type="button" class="btn btn-ghost btn-sm" data-h-open="${i}"><svg class="ic ic-sm"><use href="#i-open"/></svg><span>${t("open")}</span></button>
          <button type="button" class="btn btn-ghost btn-sm btn-icon" data-h-pdf="${i}" aria-label="PDF" title="PDF"><svg class="ic ic-sm"><use href="#i-file"/></svg></button>
        </div>
      </div>`).join("");
  }

  function toggleHistorySection() {
    const sec = $("history-section");
    const open = sec.classList.toggle("open");
    $("history-toggle").setAttribute("aria-expanded", String(open));
  }

  function reloadItem(i) {
    $("furi-input").value = history[i].text;
    updateCharCount();
    clearStatus();
    showResult(history[i].html, history[i].count);
  }

  function clearHistory() {
    history = [];
    renderHistory();
  }

  /* ── PDF Download ── */
  /* Build an off-screen container with header + furigana content, render it
     entirely via html2canvas, then place that single image into jsPDF.
     No jsPDF text() calls → no Japanese font issues. */
      async function renderToPDF(html, label, filename) {
        const date = new Date().toLocaleDateString("ja-JP");

        const wrapper = document.createElement("div");
        wrapper.style.cssText = [
          "position:fixed", "left:-9999px", "top:0",
          "width:794px",          // ≈ A4 at 96dpi
          "background:#ffffff",
          "font-family:'Noto Sans JP','Inter',sans-serif",
          "color:#1f2328",
          "padding:0",
          "border-radius:0",
        ].join(";");

        wrapper.innerHTML = `
          <style>
            .pdf-header {
              background: #1E3A8A;
              padding: 16px 32px;
              display: flex;
              align-items: center;
              justify-content: space-between;
            }
            .pdf-header-brand {
              font-family: 'Noto Serif JP', serif;
              font-size: 17px;
              font-weight: 700;
              color: #ffffff;
            }
            .pdf-header-labs {
              font-size: 10px;
              color: #00A8CC;
              font-weight: 700;
              letter-spacing: 0.08em;
              text-transform: uppercase;
              margin-top: 2px;
            }
            .pdf-header-sub {
              font-size: 11px;
              color: rgba(255,255,255,0.75);
              margin-top: 2px;
            }
            .pdf-header-date {
              font-size: 12px;
              color: rgba(255,255,255,0.75);
              text-align: right;
            }
            .pdf-body {
              padding: 28px 36px 24px;
              font-family: 'Noto Sans JP', serif;
              font-size: 19px;
              line-height: 3.8;
              color: #1f2328;
              background: #ffffff;
            }
            ruby { ruby-align: center; }
            rt {
              font-size: 10px;
              color: #1E3A8A;
              font-weight: 500;
              line-height: 1;
            }
            .pdf-footer {
              padding: 14px 36px 24px;
              border-top: 1px solid #e8edfb;
              font-size: 10px;
              color: #7a8290;
              display: flex;
              justify-content: space-between;
            }
          </style>
          <div class="pdf-header">
            <div>
              <div class="pdf-header-brand">漢字ブリッジ — Kanji Bridge</div>
              <div class="pdf-header-labs">AkihiroLabs</div>
              <div class="pdf-header-sub">${label}</div>
            </div>
            <div class="pdf-header-date">${date}</div>
          </div>
          <div class="pdf-body">${html}</div>
          <div class="pdf-footer">
            <span>AkihiroLabs · 漢字ブリッジ</span>
            <span>discord.gg/HSuaC72xMD</span>
          </div>
        `;

        document.body.appendChild(wrapper);

        try {
          // Wait a frame so fonts load
          await new Promise(r => setTimeout(r, 300));

          const canvas = await html2canvas(wrapper, {
            scale: 2,
            useCORS: true,
            allowTaint: true,
            backgroundColor: "#ffffff",
            logging: false,
            width: wrapper.offsetWidth,
            height: wrapper.offsetHeight,
          });

          const imgData = canvas.toDataURL("image/png");
          const { jsPDF } = window.jspdf;

          // A4: 210 × 297 mm
          const PDF_W = 210, PDF_H = 297;
          // Image dimensions in mm at 96dpi: px / (96/25.4)
          const PX_TO_MM = 25.4 / 96;
          const imgWmm = (canvas.width / 2) * PX_TO_MM;   // /2 because scale:2
          const imgHmm = (canvas.height / 2) * PX_TO_MM;

          const scale = PDF_W / imgWmm;
          const scaledH = imgHmm * scale;

          // Multi-page support
          const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
          let yPos = 0;
          while (yPos < scaledH) {
            if (yPos > 0) pdf.addPage();
            pdf.addImage(imgData, "PNG", 0, -yPos, PDF_W, scaledH);
            yPos += PDF_H;
          }

          pdf.save(`${filename}.pdf`);
        } finally {
          document.body.removeChild(wrapper);
        }
      }

  async function withBusy(btn, fn) {
    const span = btn.querySelector("span");
    const orig = span ? span.textContent : "";
    btn.disabled = true;
    if (span) span.textContent = t("pdfWorking");
    try { await fn(); }
    catch (e) { alert(t("pdfFail") + e.message); }
    if (span) span.textContent = orig;
    btn.disabled = false;
  }

  function downloadPDF() {
    return withBusy($("dl-btn"), () =>
      renderToPDF($("furi-out").innerHTML, "ふりがな生成", "kanji-bridge-furigana"));
  }

  function downloadHistoryPDF(i, btn) {
    const item = history[i];
    return withBusy(btn, () =>
      renderToPDF(item.html, `${item.time} · ${item.count} readings`, `furigana-${i + 1}`));
  }

  /* ── Main furigana function ── */
  let running = false;
  async function doFurigana() {
    if (running) return;
    const text = $("furi-input").value.trim();
    if (!text) { setStatus("warn", "stEmpty"); $("furi-input").focus(); return; }

    const btn = $("furi-btn"), loader = $("furi-loader");
    running = true;
    btn.disabled = true;
    loader.classList.add("show");

    try {
      if (dictState === "error") throw new Error(t("dictError"));
      if (dictState !== "ready") { setStatus("loading", "stWaiting"); await workerReadyPromise; }
      setStatus("loading", "stWorking");
      const { html, count } = await tokenizeAsync(text);
      clearStatus();
      showResult(html, count);
      addToHistory(text, html, count);
    } catch (e) {
      setStatus("error", "stError", e.message);
    }

    loader.classList.remove("show");
    btn.disabled = false;
    running = false;
  }

  /* ── Wire up ─────────────────────────────────────────────── */
  window.addEventListener("DOMContentLoaded", () => {
    $("app-version").textContent = typeof APP_VERSION !== "undefined" ? APP_VERSION : "";
    renderChips();
    applyLang();
    worker.postMessage({ type: "init" });

    document.querySelectorAll("[data-lang]").forEach(b => b.addEventListener("click", () => setLang(b.dataset.lang)));
    $("chips").addEventListener("click", e => { const c = e.target.closest("[data-ex]"); if (c) setEx(+c.dataset.ex); });

    const input = $("furi-input");
    input.addEventListener("input", () => { updateCharCount(); if (lastStatusKey === "stEmpty") clearStatus(); });
    input.addEventListener("keydown", e => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); doFurigana(); }
    });
    $("clear-input").addEventListener("click", () => { input.value = ""; updateCharCount(); clearStatus(); input.focus(); });

    $("furi-btn").addEventListener("click", doFurigana);
    $("furigana-toggle-btn").addEventListener("click", toggleFuriganaVisibility);
    $("font-down").addEventListener("click", () => changeFontSize(-1));
    $("font-up").addEventListener("click", () => changeFontSize(1));
    $("copy-btn").addEventListener("click", copyResult);
    $("dl-btn").addEventListener("click", downloadPDF);

    $("history-toggle").addEventListener("click", toggleHistorySection);
    $("clear-history").addEventListener("click", clearHistory);
    $("history-list").addEventListener("click", e => {
      const o = e.target.closest("[data-h-open]"); if (o) return reloadItem(+o.dataset.hOpen);
      const p = e.target.closest("[data-h-pdf]"); if (p) return downloadHistoryPDF(+p.dataset.hPdf, p);
    });

    // Show the Ctrl/⌘ hint matching the platform
    if (/Mac|iPhone|iPad/.test(navigator.platform || "")) document.querySelector(".run-kbd").textContent = "⌘ + Enter";
  });
})();
