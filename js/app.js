/*!
 * AkihiroLabs — Kanji Bridge — app logic
 * https://github.com/AkihiroZayar/kanji-bridge
 */
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

      const workerBlob = new Blob([WORKER_CODE], { type: 'application/javascript' });
      const worker = new Worker(URL.createObjectURL(workerBlob));

      let workerReady = false;
      let workerReadyResolve = null;
      const workerReadyPromise = new Promise(res => { workerReadyResolve = res; });

      let pendingTokenize = null; // { resolve, reject }

      function setOverlayProgress(pct, msg) {
        document.getElementById("overlay-bar").style.width = pct + "%";
        document.getElementById("overlay-steps").textContent = msg;
      }

      function hideOverlay() {
        const ov = document.getElementById("dict-overlay");
        ov.classList.add("hidden");
        setTimeout(() => ov.style.display = "none", 450);
        document.getElementById("ready-banner").classList.add("show");
      }

      worker.onmessage = function(e) {
        if (e.data.type === 'ready') {
          workerReady = true;
          setOverlayProgress(100, "✓ Ready!");
          setTimeout(hideOverlay, 400);
          if (workerReadyResolve) workerReadyResolve();
        } else if (e.data.type === 'result') {
          if (pendingTokenize) {
            pendingTokenize.resolve({ html: e.data.html, count: e.data.count });
            pendingTokenize = null;
          }
        } else if (e.data.type === 'error') {
          setOverlayProgress(0, "✗ Failed — check internet connection.");
          document.getElementById("overlay-steps").style.color = "#c0392b";
          if (pendingTokenize) { pendingTokenize.reject(new Error(e.data.msg)); pendingTokenize = null; }
        }
      };

      worker.onerror = function(e) {
        setOverlayProgress(0, "✗ Worker error — check internet connection.");
        document.getElementById("overlay-steps").style.color = "#c0392b";
      };

      function tokenizeAsync(text) {
        return new Promise((resolve, reject) => {
          pendingTokenize = { resolve, reject };
          worker.postMessage({ type: 'tokenize', text });
        });
      }

      // Animated progress steps (cosmetic — kuromoji gives no real progress events)
      const progressSteps = [
        [15,  400,  "Connecting to dictionary server…"],
        [30, 1200,  "Downloading dictionary files…"],
        [50, 2800,  "Loading grammar data…"],
        [70, 4500,  "Loading vocabulary index…"],
        [85, 6500,  "Almost ready…"],
      ];

      window.addEventListener("DOMContentLoaded", () => {
        setOverlayProgress(5, "Starting…");
        progressSteps.forEach(([pct, delay, msg]) => {
          setTimeout(() => { if (!workerReady) setOverlayProgress(pct, msg); }, delay);
        });
        // Kick off loading in the worker
        worker.postMessage({ type: 'init' });
      });

      /* ── History ── */
      const MAX_HISTORY = 3;
      let history = []; // [{text, html, count, time}]

      function timeLabel() {
        const now = new Date();
        return now.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
      }

      function addToHistory(text, html, count) {
        // Don't add duplicate of most recent
        if (history.length > 0 && history[0].text === text) return;
        history.unshift({ text, html, count, time: timeLabel() });
        if (history.length > MAX_HISTORY) history = history.slice(0, MAX_HISTORY);
        renderHistory();
      }

      function renderHistory() {
        const list = document.getElementById("history-list");
        const badge = document.getElementById("history-count");
        badge.textContent = history.length;

        if (history.length === 0) {
          list.innerHTML = '<div class="history-empty">Your last 3 processed paragraphs will appear here.</div>';
          return;
        }

        list.innerHTML = history.map((item, i) => `
          <div class="history-item" id="hitem-${i}">
            <div class="history-item-header" onclick="toggleHistory(${i})">
              <div class="history-item-meta">
                <span class="history-num">#${history.length - i}</span>
                <span class="history-preview">${item.text.slice(0, 60)}${item.text.length > 60 ? "…" : ""}</span>
              </div>
              <div class="history-actions">
                <span class="history-time">${item.time}</span>
                <button class="h-btn" onclick="event.stopPropagation(); reloadItem(${i})">↩ Load</button>
                <button class="h-btn dl" onclick="event.stopPropagation(); downloadHistoryPDF(${i})">📄 PDF</button>
              </div>
            </div>
            <div class="history-body" id="hbody-${i}">
              ${item.html}
              <div style="font-size:11px;color:var(--ink-ghost);margin-top:12px;line-height:1.4;">${item.count} reading${item.count!==1?"s":""} added · ${item.time}</div>
            </div>
          </div>
        `).join("");
      }

      function toggleHistory(i) {
        const body = document.getElementById(`hbody-${i}`);
        body.classList.toggle("open");
      }

      function reloadItem(i) {
        document.getElementById("furi-input").value = history[i].text;
        document.getElementById("furi-out").innerHTML = history[i].html;
        document.getElementById("furi-status").className = "status-line ok";
        document.getElementById("furi-status").textContent = `✓ ${history[i].count} reading${history[i].count!==1?"s":""} added.`;
        document.getElementById("dl-btn").classList.add("visible");
        document.getElementById("tool").scrollIntoView({ behavior: "smooth" });
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
          "color:#0f0e17",
          "padding:0",
          "border-radius:0",
        ].join(";");

        wrapper.innerHTML = `
          <style>
            .pdf-header {
              background: #e8e5fb;
              padding: 12px 28px;
              display: flex;
              align-items: center;
              justify-content: space-between;
              border-bottom: 2px solid #4a3fc0;
            }
            .pdf-header-brand {
              font-family: 'Noto Serif JP', serif;
              font-size: 15px;
              font-weight: 700;
              color: #4a3fc0;
            }
            .pdf-header-sub {
              font-size: 11px;
              color: #7b7896;
              margin-top: 2px;
            }
            .pdf-header-date {
              font-size: 12px;
              color: #7b7896;
              text-align: right;
            }
            .pdf-body {
              padding: 28px 36px 36px;
              font-family: 'Noto Sans JP', serif;
              font-size: 19px;
              line-height: 3.8;
              color: #0f0e17;
              background: #ffffff;
            }
            ruby { ruby-align: center; }
            rt {
              font-size: 10px;
              color: #4a3fc0;
              font-weight: 500;
              line-height: 1;
            }
          </style>
          <div class="pdf-header">
            <div>
              <div class="pdf-header-brand">漢字ブリッジ — Furigana Tool by Akihiro</div>
              <div class="pdf-header-sub">${label}</div>
            </div>
            <div class="pdf-header-date">${date}</div>
          </div>
          <div class="pdf-body">${html}</div>
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

      async function downloadPDF(elementId, filenameBase) {
        const btn = document.getElementById("dl-btn");
        const origText = btn.innerHTML;
        btn.innerHTML = "⏳ Generating PDF…";
        btn.disabled = true;
        try {
          const html = document.getElementById(elementId).innerHTML;
          await renderToPDF(html, "ふりがな生成", filenameBase + "-furigana");
        } catch(e) {
          alert("PDF generation failed: " + e.message);
        }
        btn.innerHTML = origText;
        btn.disabled = false;
      }

      async function downloadHistoryPDF(i) {
        const item = history[i];
        // Temporarily replace button text
        const btns = document.querySelectorAll(`#hitem-${i} .h-btn.dl`);
        const btn = btns[0];
        const orig = btn ? btn.innerHTML : "";
        if (btn) { btn.innerHTML = "⏳…"; btn.disabled = true; }
        try {
          await renderToPDF(item.html, `${item.time} · ${item.count} readings`, `furigana-${i + 1}`);
        } catch(e) {
          alert("PDF generation failed: " + e.message);
        }
        if (btn) { btn.innerHTML = orig; btn.disabled = false; }
      }

      /* ── Main furigana function ── */
      async function doFurigana() {
        const text = document.getElementById("furi-input").value.trim();
        if (!text) return;
        const btn    = document.getElementById("furi-btn");
        const status = document.getElementById("furi-status");
        const out    = document.getElementById("furi-out");
        const loader = document.getElementById("furi-loader");
        const dlBtn  = document.getElementById("dl-btn");

        btn.disabled = true;
        dlBtn.classList.remove("visible");
        loader.classList.add("show");
        status.className = "status-line loading";

        try {
          if (!workerReady) {
            status.textContent = "Still loading dictionary, please wait…";
            await workerReadyPromise;
          }
          status.textContent = "Analysing text…";

          const { html, count } = await tokenizeAsync(text);

          out.innerHTML = html || '<span class="furigana-placeholder">No text to display.</span>';
          status.className = "status-line ok";
          status.textContent = `✓ Done — ${count} reading${count !== 1 ? "s" : ""} added.`;
          dlBtn.classList.add("visible");
          addToHistory(text, html, count);
        } catch(e) {
          status.className = "status-line error";
          status.textContent = "✗ Error: " + e.message;
          out.innerHTML = '<span class="furigana-placeholder">Failed. Please check your internet connection.</span>';
        }

        loader.classList.remove("show");
        btn.disabled = false;
      }

      function setEx(txt) {
        document.getElementById("furi-input").value = txt;
        document.getElementById("tool").scrollIntoView({ behavior: "smooth" });
      }
