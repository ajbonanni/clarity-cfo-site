// js/main.js
// ------------------------------------------------------------
// ClarityCFO.ai - robust client-side upload & analysis
// - CSV parsing via PapaParse (fallback parser if missing)
// - XLSX parsing via SheetJS (guidance if missing)
// - PDF text extraction via PDF.js (guidance if missing)
// - Safe preview, XSS-escaped, large file guards
// - Optional Firestore write + optional /api/diagnose call
// - Exposes window.handleUpload; wires file change status
// ------------------------------------------------------------

function $(id) { return document.getElementById(id); }
function ensureEl(id, tag = "div", parentId = null) {
  let el = $(id);
  if (!el) { el = document.createElement(tag); el.id = id; (parentId ? $(parentId) : document.body).appendChild(el); }
  return el;
}
function escapeHtml(s) {
  if (typeof s !== "string") return "";
  return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
}
function formatUSD(n) { const v = Number(n) || 0; return v.toLocaleString("en-US",{style:"currency",currency:"USD"}); }

// Naive CSV fallback (simple, no quoted-comma support)
function parseCsvFallback(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const headers = lines[0].split(",").map(h => h.trim());
  return lines.slice(1).map(line => {
    const cols = line.split(",").map(c => c.trim());
    const row = {}; headers.forEach((h,i)=>row[h]=cols[i]??""); return row;
  });
}

// Try to get Firestore
function getDbSafe() {
  try {
    if (window.firebase && firebase.apps && firebase.apps.length && firebase.firestore) {
      return firebase.firestore();
    }
  } catch {}
  return null;
}

// ----- Numeric extraction helpers -----
function toNum(x) {
  if (x === null || x === undefined) return 0;
  if (typeof x === "number") return x;
  const s = String(x).replace(/[\$,()\s]/g,"");
  const neg = /\(/.test(String(x));
  const n = parseFloat(s.replace(/,/g,"")) || 0;
  return neg ? -Math.abs(n) : n;
}

function keywordsHit(str, list) {
  const s = str.toLowerCase();
  return list.some(k => s.includes(k));
}

// Extract from generic row { ... } using common column names
function extractFromRow(row) {
  const names = Object.keys(row);
  let revenue = 0, expenses = 0, burn = null;

  names.forEach((key) => {
    const val = row[key];
    const lk = key.toLowerCase();

    if (keywordsHit(lk, ["revenue","sales","turnover"])) revenue += toNum(val);
    if (keywordsHit(lk, ["expense","operating expense","opex","cost","cogs"])) expenses += toNum(val);
    if (keywordsHit(lk, ["burn"])) burn = toNum(val);
  });

  return { revenue, expenses, burn };
}

// Extract from a line of text (PDF); return {rev?,exp?,burn?}
function extractFromTextLine(line) {
  const L = line.toLowerCase();
  const numMatch = line.match(/-?\$?\(?\d[\d,]*\.?\d*\)?/g);
  const num = numMatch ? toNum(numMatch[0]) : null;

  if (num === null) return {};
  if (keywordsHit(L, ["revenue","sales"])) return { revenue: num };
  if (keywordsHit(L, ["expense","operating expense","opex","cost","cogs"])) return { expenses: num };
  if (keywordsHit(L, ["burn"])) return { burn: num };
  return {};
}

// ----- Core flow -----
async function handleUpload() {
  const input = $("fileInput") || $("fileInput2");
  const uploadStatus = ensureEl("uploadStatus", "p");
  const resultBox = ensureEl("diagnosticResults", "div");

  const file = (input && input.files && input.files[0]) ? input.files[0] : null;
  if (!file) { alert("Please select a file first."); return; }

  const name = file.name || "unnamed";
  const ext = (name.split(".").pop() || "").toLowerCase();
  const sizeMB = (file.size || 0) / (1024 * 1024);

  uploadStatus.textContent = `⏳ Processing "${name}"...`;
  uploadStatus.classList.remove("hidden");

  if (sizeMB > 25) {
    uploadStatus.textContent = `⚠️ ${sizeMB.toFixed(1)} MB file. For very large files, consider server-side parsing.`;
    return;
  }

  // running totals
  let revenue = 0, expenses = 0; let burn = null;

  const readAsText = () => new Promise((resolve,reject)=>{
    const r = new FileReader(); r.onerror=()=>reject(r.error); r.onload=()=>resolve(String(r.result||"")); r.readAsText(file,"utf-8");
  });
  const readAsArrayBuffer = () => new Promise((resolve,reject)=>{
    const r = new FileReader(); r.onerror=()=>reject(r.error); r.onload=()=>resolve(r.result); r.readAsArrayBuffer(file);
  });

  try {
    // ---------- CSV / TSV ----------
    if (["csv","tsv"].includes(ext)) {
      if (window.Papa && typeof Papa.parse === "function") {
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: async (res) => {
            try {
              (res.data || []).forEach(row => {
                const { revenue: r, expenses: e, burn: b } = extractFromRow(row);
                revenue += r; expenses += e; if (b !== null) burn = b;
              });
              await finalize(name, revenue, expenses, burn, uploadStatus, resultBox);
            } catch (err) { console.error(err); uploadStatus.textContent = "❌ CSV processing failed."; }
          },
          error: (err) => { console.error("Papa error:", err); uploadStatus.textContent = "❌ CSV parsing error."; }
        });
      } else {
        const text = await readAsText();
        const rows = parseCsvFallback(text);
        rows.forEach(row => {
          const { revenue: r, expenses: e, burn: b } = extractFromRow(row);
          revenue += r; expenses += e; if (b !== null) burn = b;
        });
        await finalize(name, revenue, expenses, burn, uploadStatus, resultBox);
      }
      return;
    }

    // ---------- XLSX / XLS ----------
    if (["xlsx","xlsm","xls"].includes(ext)) {
      if (window.XLSX && typeof XLSX.read === "function") {
        const ab = await readAsArrayBuffer();
        const wb = XLSX.read(ab, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(sheet);
        (data || []).forEach(row => {
          const { revenue: r, expenses: e, burn: b } = extractFromRow(row);
          revenue += r; expenses += e; if (b !== null) burn = b;
        });
        await finalize(name, revenue, expenses, burn, uploadStatus, resultBox);
      } else {
        resultBox.innerHTML = `
          <div class="p-3 rounded border border-blue-200 bg-blue-50 text-blue-900">
            Excel detected (<strong>${escapeHtml(name)}</strong>) but SheetJS is not loaded. It should be included via CDN in index.html.
          </div>`;
        resultBox.classList.remove("hidden");
        uploadStatus.textContent = "ℹ️ Waiting for XLSX support.";
      }
      return;
    }

    // ---------- PDF ----------
    if (ext === "pdf") {
      if (window.pdfjsLib && pdfjsLib.getDocument) {
        const arrayBuffer = await readAsArrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let textAll = "";

        for (let p = 1; p <= pdf.numPages; p++) {
          const page = await pdf.getPage(p);
          const tc = await page.getTextContent();
          const pageText = tc.items.map(i => i.str).join(" ");
          textAll += "\n" + pageText;

          // Try to extract on the fly
          pageText.split(/\r?\n/).forEach(line => {
            const out = extractFromTextLine(line);
            if (out.revenue !== undefined) revenue += out.revenue;
            if (out.expenses !== undefined) expenses += out.expenses;
            if (out.burn !== undefined) burn = out.burn;
          });
        }

        // If nothing found by keywords, still show preview
        if (revenue === 0 && expenses === 0 && burn === null) {
          const box = ensureEl("diagnosticResults","div");
          const preview = textAll.slice(0, 200000);
          box.innerHTML = `<div class="p-3 rounded border border-blue-200 bg-blue-50 text-blue-900">
            PDF parsed. Could not auto-detect Revenue/Expenses/Burn keywords. Showing text preview; you can adjust keyword rules in main.js.
            </div><pre style="white-space:pre-wrap;overflow:auto;max-height:50vh;padding:12px;border:1px solid #e5e7eb;border-radius:8px;background:#fafafa">${escapeHtml(preview)}</pre>`;
          box.classList.remove("hidden");
          uploadStatus.textContent = "ℹ️ PDF parsed; no numeric matches found.";
          return;
        }

        await finalize(name, revenue, expenses, burn, uploadStatus, resultBox);
      } else {
        resultBox.innerHTML = `
          <div class="p-3 rounded border border-blue-200 bg-blue-50 text-blue-900">
            PDF detected (<strong>${escapeHtml(name)}</strong>) but PDF.js is not loaded. It should be included via CDN in index.html.
          </div>`;
        resultBox.classList.remove("hidden");
        uploadStatus.textContent = "ℹ️ PDF parsing requires PDF.js.";
      }
      return;
    }

    // ---------- JSON / TXT / LOG ----------
    if (["json","txt","log"].includes(ext)) {
      const text = await readAsText();
      const box = ensureEl("diagnosticResults","div");
      const preview = text.length > 200000 ? text.slice(0,200000) + "\n…(truncated preview)" : text;
      box.innerHTML = `<pre style="white-space:pre-wrap;overflow:auto;max-height:60vh;padding:12px;border:1px solid #e5e7eb;border-radius:8px;background:#fafafa">${escapeHtml(preview)}</pre>`;
      box.classList.remove("hidden");
      uploadStatus.textContent = "✅ Preview ready.";
      return;
    }

    uploadStatus.textContent = `❌ Unsupported file type: .${ext}`;
  } catch (err) {
    console.error(err);
    uploadStatus.textContent = `❌ Upload error: ${err.message || String(err)}`;
  }
}

// ----- finalize: persist, call API, render -----
async function finalize(filename, revenue, expenses, burn, uploadStatus, resultBox) {
  if (burn === null || Number.isNaN(burn)) burn = expenses - revenue;
  const summaryHtml = `
    <p class="mb-2"><strong>📊 Revenue:</strong> ${formatUSD(revenue)}
    &nbsp;|&nbsp;<strong>Expenses:</strong> ${formatUSD(expenses)}
    &nbsp;|&nbsp;<strong>Burn:</strong> ${formatUSD(burn)}</p>
  `;

  // Optional Firestore write
  try {
    const db = getDbSafe();
    if (db) {
      await db.collection("financial_uploads").add({
        filename,
        revenue, expenses, burn,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
  } catch (e) { console.warn("Firestore write skipped/failed:", e); }

  // Try /api/diagnose; if unavailable, show local summary
  let rendered = false;
  try {
    const res = await fetch("/api/diagnose", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ revenue, expenses, burn, filename })
    });
    if (res.ok) {
      const { flags = [], summary = "", narrative = "" } = await res.json();
      resultBox.innerHTML = `
        ${summaryHtml}
        <p><strong>📋 Summary:</strong> ${escapeHtml(summary)}</p>
        <p><strong>⚠️ Flags:</strong> ${escapeHtml(Array.isArray(flags) ? flags.join(", ") : String(flags))}</p>
        <p><strong>📖 Narrative:</strong> ${escapeHtml(narrative)}</p>`;
      rendered = true;
    }
  } catch (e) {
    console.info("Diagnose API not reachable; showing local only.");
  }

  if (!rendered) {
    resultBox.innerHTML = `
      <div class="p-3 rounded border border-yellow-300 bg-yellow-50 text-yellow-900">
        Could not reach /api/diagnose. Showing local totals only.
      </div>
      ${summaryHtml}`;
  }

  resultBox.classList.remove("hidden");
  uploadStatus.textContent = "✅ Analysis complete.";

  // Optional chart render
  try {
    if (typeof window.renderChart === "function") {
      window.renderChart(revenue, expenses, burn);
    }
  } catch (e) { console.warn("Chart render skipped:", e); }
}

// Expose for HTML wiring
window.handleUpload = handleUpload;

// Show selection immediately
document.addEventListener("DOMContentLoaded", () => {
  ["fileInput","fileInput2"].forEach(id => {
    const inp = $(id);
    if (!inp) return;
    inp.addEventListener("change", () => {
      const f = inp.files && inp.files[0];
      if (!f) return;
      const st = ensureEl("uploadStatus","p");
      st.textContent = `✅ Selected: ${f.name}`;
      st.classList.remove("hidden");
    });
  });
});

// Silence extension noise
window.addEventListener("error", (e) => {
  if (e && typeof e.message === "string" && e.message.includes("asynchronous response")) {
    e.stopImmediatePropagation();
  }
});
// Force redeploy fix – 08/29/2025
