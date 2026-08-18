import { useState, useRef, useCallback } from "react";
import * as XLSX from "xlsx";
import { 
  Upload, X, Check, AlertTriangle, FileSpreadsheet, 
  Sparkles, Layers, CheckCircle2, ArrowRight, RefreshCw, 
  FileText, ShieldCheck
} from "lucide-react";

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
  const [successReport, setSuccessReport] = useState(null);
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
          setSheetPickers((prev) => [...prev, { id: `wb_${Date.now()}_${Math.random()}`, fileName: file.name, supplierName: baseName, currency: "KES", sheets }]);
        } catch (err) {
          setSheetPickers((prev) => [...prev, { id: `wb_${Date.now()}`, fileName: file.name, supplierName: file.name, currency: "KES", sheets: [], error: "File parse error. Ensure .xlsx or .csv format." }]);
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
        id: `pf_${Date.now()}_${Math.random()}`,
        fileName: sp.fileName,
        sheetName: s.name,
        supplierName: sp.supplierName,
        currency: sp.currency,
        rawRows: s.rawRows,
        headerRowIndex,
        headers,
        dataRows,
        mapping: guessMapping(headers, dataRows),
      };
    });
    setPendingFiles((prev) => [...prev, ...newPending]);
    setSheetPickers((prev) => prev.filter((item) => item.id !== sp.id));
  };

  const confirmPending = async (pf) => {
    if (!pf.mapping || !pf.mapping.name || !pf.mapping.price) return;
    setImporting(true);
    setSuccessReport(null);

    const items = pf.dataRows.map((row) => {
      const name = String(row[pf.mapping.name] ?? "").trim();
      const price = parseFloat(String(row[pf.mapping.price]).replace(/[^0-9.]/g, ""));
      if (!name || isNaN(price)) return null;
      const sku = pf.mapping.sku ? String(row[pf.mapping.sku] ?? "").trim() : "";
      const stockRaw = pf.mapping.stock ? String(row[pf.mapping.stock] ?? "") : "In Stock";
      return { name, sku, price, stockRaw };
    }).filter(Boolean);

    try {
      const res = await fetch('/api/imports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplier_name: pf.supplierName,
          currency: pf.currency,
          items
        })
      });
      const data = await res.json();
      setPendingFiles((prev) => prev.filter((p) => p.id !== pf.id));
      setSuccessReport({ supplier: pf.supplierName, count: items.length });
      if (onImportSuccess) onImportSuccess();
    } catch (err) {
      console.error('Import failed:', err);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="animate-fade" style={{ maxWidth: '1100px', margin: '0 auto' }}>
      
      {/* ─── Header ─── */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--forest-text)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
          Catalog Ingestion Pipeline
        </div>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
          Import Supplier Pricelists
        </h1>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
          Drop raw Excel, CSV, or supplier pricelist spreadsheets. The pipeline extracts SKUs, normalizes currency, and matches canonical inventory.
        </p>
      </div>

      {successReport && (
        <div className="panel" style={{ padding: '14px 18px', marginBottom: '16px', backgroundColor: 'var(--color-success-bg)', borderColor: 'rgba(47, 107, 82, 0.4)', color: 'var(--color-success-text)', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={16} />
            <span>Successfully ingested <strong>{successReport.count} items</strong> from <strong>{successReport.supplier}</strong>.</span>
          </div>
          <button onClick={() => setSuccessReport(null)} className="btn-ghost" style={{ padding: '2px' }}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* ─── Drag and Drop Upload Zone ─── */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => { e.preventDefault(); setDragActive(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => fileInputRef.current?.click()}
        className="panel"
        style={{
          padding: '40px 24px',
          textAlign: 'center',
          borderStyle: 'dashed',
          borderColor: dragActive ? 'var(--forest-bright)' : 'var(--border-default)',
          backgroundColor: dragActive ? 'var(--bg-elevated)' : 'var(--bg-surface)',
          cursor: 'pointer',
          marginBottom: '20px',
          transition: 'all 0.15s ease'
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".xlsx,.xls,.csv"
          onChange={(e) => handleFiles(e.target.files)}
          style={{ display: 'none' }}
        />
        <div style={{ background: 'var(--forest-light)', width: '44px', height: '44px', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
          <Upload size={20} color="var(--forest-bright)" />
        </div>
        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
          Drop Excel or CSV Supplier Pricelists Here
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
          Supports .xlsx, .xls, .csv · Multi-tab spreadsheets automatically parsed
        </div>
      </div>

      {/* ─── Sheet Pickers (Step 1) ─── */}
      {sheetPickers.map((sp) => (
        <div key={sp.id} className="panel" style={{ padding: '18px 20px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileSpreadsheet size={18} color="var(--forest-bright)" />
              <span style={{ fontWeight: 600, fontSize: '14px' }}>{sp.fileName}</span>
            </div>
            <button onClick={() => setSheetPickers((prev) => prev.filter((i) => i.id !== sp.id))} className="btn-ghost" style={{ padding: '4px' }}>
              <X size={14} />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '16px', marginBottom: '14px' }}>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                Supplier Entity Name
              </label>
              <input
                value={sp.supplierName}
                onChange={(e) => {
                  const val = e.target.value;
                  setSheetPickers((prev) => prev.map((item) => item.id === sp.id ? { ...item, supplierName: val } : item));
                }}
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                Catalog Currency
              </label>
              <select
                value={sp.currency}
                onChange={(e) => {
                  const val = e.target.value;
                  setSheetPickers((prev) => prev.map((item) => item.id === sp.id ? { ...item, currency: val } : item));
                }}
                style={{ width: '100%' }}
              >
                <option value="KES">KES (Kenyan Shillings)</option>
                <option value="USD">USD (US Dollar)</option>
                <option value="EUR">EUR (Euro)</option>
                <option value="GBP">GBP (British Pound)</option>
              </select>
            </div>
          </div>

          <div style={{ marginBottom: '14px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
              Select Sheets to Ingest
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {sp.sheets.map((sh, idx) => (
                <label 
                  key={sh.name} 
                  style={{ 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    gap: '6px', 
                    padding: '6px 10px', 
                    borderRadius: 'var(--radius-xs)', 
                    background: 'var(--bg-elevated)', 
                    border: '1px solid var(--border-subtle)',
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={sh.checked}
                    onChange={(e) => {
                      const ch = e.target.checked;
                      setSheetPickers((prev) => prev.map((item) => {
                        if (item.id !== sp.id) return item;
                        const copy = [...item.sheets];
                        copy[idx] = { ...copy[idx], checked: ch };
                        return { ...item, sheets: copy };
                      }));
                    }}
                    style={{ accentColor: 'var(--forest-primary)' }}
                  />
                  <span>{sh.name} ({sh.rawRows.length} rows)</span>
                </label>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={() => confirmSheetPicker(sp)} className="btn-primary" style={{ fontSize: '12px' }}>
              Configure Column Mappings <ArrowRight size={13} />
            </button>
          </div>
        </div>
      ))}

      {/* ─── Pending File Mappings & Confirmation (Step 2) ─── */}
      {pendingFiles.map((pf) => (
        <div key={pf.id} className="panel" style={{ padding: '18px 20px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>
                {pf.supplierName} · {pf.sheetName}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {pf.dataRows.length} data rows detected · Currency: {pf.currency}
              </div>
            </div>
            <button onClick={() => setPendingFiles((prev) => prev.filter((i) => i.id !== pf.id))} className="btn-ghost" style={{ padding: '4px' }}>
              <X size={14} />
            </button>
          </div>

          {/* Mapping Controls */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' }}>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                Product Title / Name *
              </label>
              <select
                value={pf.mapping.name}
                onChange={(e) => {
                  const val = e.target.value;
                  setPendingFiles((prev) => prev.map((item) => item.id === pf.id ? { ...item, mapping: { ...item.mapping, name: val } } : item));
                }}
                style={{ width: '100%', borderColor: pf.mapping.name ? 'var(--forest-border)' : 'var(--border-default)' }}
              >
                <option value="">-- Select Column --</option>
                {pf.headers.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                Quoted Price *
              </label>
              <select
                value={pf.mapping.price}
                onChange={(e) => {
                  const val = e.target.value;
                  setPendingFiles((prev) => prev.map((item) => item.id === pf.id ? { ...item, mapping: { ...item.mapping, price: val } } : item));
                }}
                style={{ width: '100%', borderColor: pf.mapping.price ? 'var(--forest-border)' : 'var(--border-default)' }}
              >
                <option value="">-- Select Column --</option>
                {pf.headers.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                Supplier SKU / MPN
              </label>
              <select
                value={pf.mapping.sku}
                onChange={(e) => {
                  const val = e.target.value;
                  setPendingFiles((prev) => prev.map((item) => item.id === pf.id ? { ...item, mapping: { ...item.mapping, sku: val } } : item));
                }}
                style={{ width: '100%' }}
              >
                <option value="">-- (Optional) --</option>
                {pf.headers.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                Stock / Availability
              </label>
              <select
                value={pf.mapping.stock}
                onChange={(e) => {
                  const val = e.target.value;
                  setPendingFiles((prev) => prev.map((item) => item.id === pf.id ? { ...item, mapping: { ...item.mapping, stock: val } } : item));
                }}
                style={{ width: '100%' }}
              >
                <option value="">-- (Optional) --</option>
                {pf.headers.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button
              onClick={() => confirmPending(pf)}
              disabled={importing || !pf.mapping.name || !pf.mapping.price}
              className="btn-primary"
              style={{ fontSize: '12px' }}
            >
              {importing ? (
                <>
                  <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> Ingesting & Resolving Entities...
                </>
              ) : (
                <>
                  <Check size={14} /> Publish Ingestion
                </>
              )}
            </button>
          </div>
        </div>
      ))}

    </div>
  );
}
