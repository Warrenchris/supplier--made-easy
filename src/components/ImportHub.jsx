import { useState, useRef, useCallback } from "react";
import * as XLSX from "xlsx";
import { Upload, X, Check, AlertTriangle, FileSpreadsheet, Sparkles, Layers } from "lucide-react";

const NAME_KEYS = ["product", "name", "description", "item", "title", "model name", "product name"];
const SKU_KEYS = ["sku", "code", "part", "model", "mpn", "id", "ean", "upc", "part number"];
const PRICE_KEYS = ["price", "cost", "wholesale", "unit price", "rrp", "rate", "usd", "kes", "eur"];
const STOCK_KEYS = ["stock", "qty", "quantity", "availability", "avail", "inventory", "status"];
const COVER_SHEET_RX = /^(home\s*page|main\s*page|cover|contents|index|welcome|terms|info)$/i;

function guessColumn(headers, keywords) {
  const lower = headers.map((h) => String(h).toLowerCase());
  for (const kw of keywords) { const idx = lower.findIndex((h) => h === kw); if (idx !== -1) return headers[idx]; }
  for (const kw of keywords) { const idx = lower.findIndex((h) => h.includes(kw)); if (idx !== -1) return headers[idx]; }
  return "";
}

function guessMapping(headers, dataRows) {
  const sku = guessColumn(headers, SKU_KEYS);
  const price = guessColumn(headers, PRICE_KEYS);
  const stock = guessColumn(headers, STOCK_KEYS);
  let name = guessColumn(headers, NAME_KEYS);
  const used = new Set([sku, price, stock].filter(Boolean));
  if (!name) {
    let bestCol = "", bestLen = -1;
    headers.forEach((h) => {
      if (used.has(h)) return;
      const sample = dataRows.slice(0, 30).map((r) => String(r[h] ?? ""));
      const nonEmpty = sample.filter((s) => s.trim() !== "");
      if (!nonEmpty.length) return;
      const numericFrac = nonEmpty.filter((s) => /^[\d.,\-\s]+$/.test(s)).length / nonEmpty.length;
      if (numericFrac > 0.6) return;
      const avgLen = nonEmpty.reduce((a, s) => a + s.length, 0) / nonEmpty.length;
      if (avgLen > bestLen) { bestLen = avgLen; bestCol = h; }
    });
    name = bestCol;
  }
  return { sku, price, stock, name, specs: [] };
}

function detectHeaderRow(rawRows) {
  const KEY_ALL = [...NAME_KEYS, ...SKU_KEYS, ...PRICE_KEYS, ...STOCK_KEYS];
  let bestIdx = 0, bestScore = -1;
  const scanRows = Math.min(rawRows.length, 15);
  for (let i = 0; i < scanRows; i++) {
    let score = 0;
    (rawRows[i] || []).forEach((cell) => {
      const s = String(cell ?? "").toLowerCase();
      if (s && KEY_ALL.some((k) => s.includes(k))) score++;
    });
    if (score > bestScore) { bestScore = score; bestIdx = i; }
  }
  return bestIdx;
}

function buildHeaders(rawRows, headerRowIndex) {
  const raw = rawRows[headerRowIndex] || [];
  let headers = raw.map((h, i) => (h === "" || h === undefined || h === null ? `Column ${i + 1}` : String(h).replace(/\s+/g, " ").trim()));
  if (!headers.length) headers = ["Column 1"];
  const seen = {};
  return headers.map((h) => { if (seen[h] !== undefined) { seen[h]++; return `${h} (${seen[h]})`; } seen[h] = 0; return h; });
}

function buildDataRows(rawRows, headerRowIndex, headers) {
  return rawRows.slice(headerRowIndex + 1)
    .map((r) => { const obj = {}; headers.forEach((h, i) => { obj[h] = r[i] !== undefined ? r[i] : ""; }); return obj; })
    .filter((r) => Object.values(r).some((v) => String(v).trim() !== ""));
}

export default function ImportHub({ onImportSuccess }) {
  const [sheetPickers, setSheetPickers] = useState([]);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);

  const handleFiles = useCallback((fileList) => {
    Array.from(fileList).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const wb = XLSX.read(data, { type: "array" });
          const sheets = wb.SheetNames.map((name) => {
            const sheet = wb.Sheets[name];
            const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, defval: "" });
            return { name, rawRows, checked: rawRows.length > 1 && !COVER_SHEET_RX.test(name.trim()) };
          }).filter((s) => s.rawRows.length > 0);
          const baseName = file.name.replace(/\.(xlsx|xls|csv)$/i, "");
          setSheetPickers((prev) => [...prev, { id: `wb_${Date.now()}_${Math.random()}`, fileName: file.name, supplierName: baseName, currency: "USD", sheets }]);
        } catch (err) {
          setSheetPickers((prev) => [...prev, { id: `wb_${Date.now()}`, fileName: file.name, supplierName: file.name, currency: "USD", sheets: [], error: "Couldn't parse file. Try re-saving as .xlsx or .csv." }]);
        }
      };
      reader.readAsArrayBuffer(file);
    });
  }, []);

  const confirmSheetPicker = (sp) => {
    const chosen = sp.sheets.filter((s) => s.checked);
    const newPending = chosen.map((s) => {
      const headerRowIndex = detectHeaderRow(s.rawRows);
      const headers = buildHeaders(s.rawRows, headerRowIndex);
      const dataRows = buildDataRows(s.rawRows, headerRowIndex, headers);
      return {
        id: `pf_${Date.now()}_${Math.random()}`, fileName: sp.fileName, sheetName: s.name,
        supplierName: sp.supplierName, currency: sp.currency,
        rawRows: s.rawRows, headerRowIndex,
        mapping: guessMapping(headers, dataRows),
      };
    });
    setPendingFiles((prev) => [...prev, ...newPending]);
    setSheetPickers((prev) => prev.filter((item) => item.id !== sp.id));
  };

  const confirmPending = async (pf) => {
    if (!pf.mapping || !pf.mapping.name || !pf.mapping.price) return;
    setImporting(true);

    const headers = buildHeaders(pf.rawRows, pf.headerRowIndex);
    const dataRows = buildDataRows(pf.rawRows, pf.headerRowIndex, headers);

    const items = dataRows.map((row) => {
      const name = String(row[pf.mapping.name] ?? "").trim();
      const price = parseFloat(String(row[pf.mapping.price]).replace(/[^0-9.]/g, ""));
      if (!name || isNaN(price)) return null;
      const sku = pf.mapping.sku ? String(row[pf.mapping.sku] ?? "").trim() : "";
      const stockRaw = pf.mapping.stock ? String(row[pf.mapping.stock] ?? "") : "In Stock";
      return { name, sku, price, stockRaw };
    }).filter(Boolean);

    try {
      await fetch('/api/imports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplier_name: pf.supplierName,
          currency: pf.currency,
          items
        })
      });
      setPendingFiles((prev) => prev.filter((p) => p.id !== pf.id));
      if (onImportSuccess) onImportSuccess();
    } catch (err) {
      console.error(err);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div style={{ maxWidth: "1240px", margin: "0 auto", color: "#f0f3f8" }}>
      <div style={{ marginBottom: "20px" }}>
        <h2 style={{ fontSize: "20px", fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
          <Upload size={22} color="#2dd4bf" /> Ingestion & Column Mapping Hub
        </h2>
        <p style={{ fontSize: "13px", color: "#949eb2", marginTop: "4px" }}>
          Upload supplier pricelists in Excel (.xlsx, .xls) or CSV. Auto-detects header rows and maps product names, SKUs, prices, and specs.
        </p>
      </div>

      <div
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => { e.preventDefault(); setDragActive(false); handleFiles(e.dataTransfer.files); }}
        style={{
          background: dragActive ? "rgba(45, 212, 191, 0.05)" : "#181b24",
          border: `2px dashed ${dragActive ? "#2dd4bf" : "#2b303d"}`,
          borderRadius: "14px",
          padding: "36px 20px",
          textAlign: "center",
          cursor: "pointer",
          marginBottom: "24px",
          transition: "all 0.2s ease"
        }}
      >
        <Upload size={32} color={dragActive ? "#2dd4bf" : "#949eb2"} style={{ marginBottom: "10px" }} />
        <div style={{ fontSize: "15px", fontWeight: 600, color: "#f0f3f8" }}>Drop Excel or CSV Pricelists Here</div>
        <div style={{ fontSize: "12px", color: "#949eb2", marginTop: "4px" }}>Multi-sheet workbooks automatically scanned. Client-side privacy guaranteed.</div>
        <input ref={fileInputRef} type="file" multiple accept=".csv,.xlsx,.xls" hidden onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }} />
      </div>

      {/* Sheet Picker Cards */}
      {sheetPickers.map((sp) => (
        <div key={sp.id} style={{ background: "#181b24", border: "1px solid #2b303d", borderRadius: "12px", padding: "18px", marginBottom: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <span style={{ fontSize: "14px", fontWeight: 600 }}>{sp.fileName} ({sp.sheets.length} sheets)</span>
              <input style={{ background: "#202430", border: "1px solid #2b303d", color: "#f0f3f8", padding: "6px 10px", borderRadius: "6px", fontSize: "13px", outline: "none" }} value={sp.supplierName} onChange={(e) => setSheetPickers(sheetPickers.map(s => s.id === sp.id ? { ...s, supplierName: e.target.value } : s))} placeholder="Supplier Name" />
              <input style={{ background: "#202430", border: "1px solid #2b303d", color: "#f0f3f8", padding: "6px 10px", borderRadius: "6px", fontSize: "13px", width: "90px", outline: "none" }} value={sp.currency} onChange={(e) => setSheetPickers(sheetPickers.map(s => s.id === sp.id ? { ...s, currency: e.target.value } : s))} placeholder="Currency" />
            </div>
            <button onClick={() => setSheetPickers(sheetPickers.filter(s => s.id !== sp.id))} style={{ background: "none", border: "none", color: "#949eb2", cursor: "pointer" }}><X size={16} /></button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "8px", marginBottom: "16px" }}>
            {sp.sheets.map((s) => (
              <label key={s.name} style={{ display: "flex", alignItems: "center", gap: "8px", background: "#202430", padding: "8px 10px", borderRadius: "8px", cursor: "pointer", fontSize: "12px" }}>
                <input type="checkbox" checked={s.checked} onChange={() => setSheetPickers(sheetPickers.map(spItem => spItem.id !== sp.id ? spItem : { ...spItem, sheets: spItem.sheets.map(sh => sh.name === s.name ? { ...sh, checked: !sh.checked } : sh) }))} />
                <span>{s.name} ({s.rawRows.length} rows)</span>
              </label>
            ))}
          </div>

          <button onClick={() => confirmSheetPicker(sp)} style={{ background: "#2dd4bf", border: "none", color: "#042f2e", padding: "8px 16px", borderRadius: "8px", fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <Check size={16} /> Continue with Selected Sheets
          </button>
        </div>
      ))}

      {/* Pending Column Mapping Cards */}
      {pendingFiles.map((pf) => {
        const headers = buildHeaders(pf.rawRows, pf.headerRowIndex);
        return (
          <div key={pf.id} style={{ background: "#181b24", border: "1px solid #2dd4bf", borderRadius: "12px", padding: "20px", marginBottom: "16px" }}>
            <div style={{ fontSize: "14px", fontWeight: 700, color: "#2dd4bf", marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
              <FileSpreadsheet size={16} /> Sheet: {pf.sheetName} ({pf.supplierName})
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px", marginBottom: "16px" }}>
              {[["name", "Product Name *"], ["sku", "SKU / Code"], ["price", "Price *"], ["stock", "Stock / Availability"]].map(([field, label]) => (
                <div key={field}>
                  <label style={{ fontSize: "11px", color: "#949eb2", display: "block", marginBottom: "4px" }}>{label}</label>
                  <select
                    value={pf.mapping[field]}
                    onChange={(e) => setPendingFiles(pendingFiles.map(p => p.id === pf.id ? { ...p, mapping: { ...p.mapping, [field]: e.target.value } } : p))}
                    style={{ background: "#202430", border: "1px solid #2b303d", color: "#f0f3f8", padding: "8px 10px", borderRadius: "8px", width: "100%", fontSize: "13px", outline: "none" }}
                  >
                    <option value="">— select column —</option>
                    {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              ))}
            </div>

            <button
              disabled={importing || !pf.mapping.name || !pf.mapping.price}
              onClick={() => confirmPending(pf)}
              style={{ background: "#2dd4bf", border: "none", color: "#042f2e", padding: "8px 18px", borderRadius: "8px", fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              <Check size={16} /> Import & Run AI Matcher
            </button>
          </div>
        );
      })}
    </div>
  );
}
