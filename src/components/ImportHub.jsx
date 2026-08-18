import { useState, useRef, useCallback } from "react";
import * as XLSX from "xlsx";
import { 
  Upload, X, Check, AlertTriangle, FileSpreadsheet, 
  Sparkles, Layers, CheckCircle2, ArrowRight, RefreshCw, 
  FileText, ShieldCheck, Eye, HelpCircle, ArrowUpRight
} from "lucide-react";

const NAME_KEYS = ["product", "name", "description", "item", "title", "model name", "product name", "details", "desc"];
const SKU_KEYS = ["sku", "code", "part", "model", "mpn", "id", "ean", "upc", "part number", "item code", "p/n"];
const PRICE_KEYS = ["price", "cost", "wholesale", "unit price", "rrp", "rate", "usd", "kes", "eur", "amount", "unit cost", "quote"];
const STOCK_KEYS = ["stock", "qty", "quantity", "availability", "avail", "inventory", "status", "count", "on hand"];

export function parsePriceValue(val) {
  if (val === null || val === undefined) return NaN;
  if (typeof val === "number") return isNaN(val) ? NaN : val;
  
  let str = String(val).trim();
  if (!str) return NaN;

  // Clean currency symbols and labels like 'KES', 'USD', '$', '€', '£', '/-', 'ea'
  str = str.replace(/^(USD|KES|EUR|GBP|KSH|US\$|\$|€|£)\s*/i, "")
           .replace(/\s*(\/\-|\/ea|ea|each|per unit)$/i, "")
           .trim();

  // European format check e.g. 1.250,50 or 1250,50
  if (/\d+\.\d{3},\d{2}/.test(str)) {
    str = str.replace(/\./g, "").replace(",", ".");
  } else if (/^\d+,\d{2}$/.test(str)) {
    str = str.replace(",", ".");
  } else {
    // Standard thousands comma format e.g. 1,450.50
    str = str.replace(/,/g, "");
  }

  // Extract first floating-point number
  const match = str.match(/[-+]?[0-9]*\.?[0-9]+/);
  if (!match) return NaN;
  const num = parseFloat(match[0]);
  return isNaN(num) ? NaN : num;
}

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
    name = bestCol || headers[0] || "";
  }
  return { sku, price, stock, name };
}

function detectHeaderRow(rawRows) {
  const KEY_ALL = [...NAME_KEYS, ...SKU_KEYS, ...PRICE_KEYS, ...STOCK_KEYS];
  let bestIdx = 0, bestScore = -1;
  const scanRows = Math.min(rawRows.length, 15);
  for (let i = 0; i < scanRows; i++) {
    let score = 0;
    (rawRows[i] || []).forEach((cell) => {
      const s = String(cell ?? "").toLowerCase();
      if (s && KEY_ALL.some((k) => s.includes(k))) score += 2;
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
    .map((r, rowIdx) => { 
      const obj = { __rowNum: headerRowIndex + 2 + rowIdx }; 
      headers.forEach((h, i) => { obj[h] = r[i] !== undefined ? r[i] : ""; }); 
      return obj; 
    })
    .filter((r) => Object.entries(r).some(([k, v]) => k !== '__rowNum' && String(v).trim() !== ""));
}

export default function ImportHub({ onImportSuccess, onNavigateQueue }) {
  const [sheetPickers, setSheetPickers] = useState([]);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [importing, setImporting] = useState(false);
  const [successReport, setSuccessReport] = useState(null);
  const [previewFileId, setPreviewFileId] = useState(null);
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
            return { name, rawRows, checked: rawRows.length > 0 };
          }).filter((s) => s.rawRows.length > 0);
          const baseName = file.name.replace(/\.(xlsx|xls|csv)$/i, "");
          setSheetPickers((prev) => [...prev, { id: `wb_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, fileName: file.name, supplierName: baseName, currency: "KES", sheets }]);
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
        id: `pf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
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

  const updateHeaderRow = (pfId, newIndex) => {
    setPendingFiles((prev) => prev.map((pf) => {
      if (pf.id !== pfId) return pf;
      const validIdx = Math.max(0, Math.min(newIndex, pf.rawRows.length - 1));
      const headers = buildHeaders(pf.rawRows, validIdx);
      const dataRows = buildDataRows(pf.rawRows, validIdx, headers);
      return {
        ...pf,
        headerRowIndex: validIdx,
        headers,
        dataRows,
        mapping: guessMapping(headers, dataRows)
      };
    }));
  };

  const confirmPending = async (pf) => {
    if (!pf.mapping || !pf.mapping.name || !pf.mapping.price) return;
    setImporting(true);
    setSuccessReport(null);

    const items = [];
    let skippedCount = 0;

    pf.dataRows.forEach((row) => {
      let name = String(row[pf.mapping.name] ?? "").trim();
      const sku = pf.mapping.sku ? String(row[pf.mapping.sku] ?? "").trim() : "";
      
      // Fallback: if name is empty but SKU is present, use SKU as product name
      if (!name && sku) name = sku;

      const price = parsePriceValue(row[pf.mapping.price]);
      
      if (!name || isNaN(price) || price < 0) {
        skippedCount++;
        return;
      }

      const stockRaw = pf.mapping.stock ? String(row[pf.mapping.stock] ?? "") : "In Stock";
      items.push({ name, sku, price, stockRaw });
    });

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
      setSuccessReport({
        supplier: pf.supplierName,
        totalSubmitted: items.length,
        skippedInFile: skippedCount,
        autoConfirmedCount: data.autoConfirmedCount || 0,
        reviewQueueCount: data.reviewQueueCount || 0,
        createdNewCount: data.createdNewCount || 0
      });

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
          Upload Excel or CSV supplier pricelists. The pipeline normalizes part numbers, converts currencies, and accurately matches canonical inventory.
        </p>
      </div>

      {/* ─── Ingestion Success Report ─── */}
      {successReport && (
        <div className="panel" style={{ padding: '18px 20px', marginBottom: '20px', backgroundColor: 'var(--color-success-bg)', borderColor: 'rgba(47, 107, 82, 0.4)', fontSize: '13px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-success-text)', fontWeight: 600 }}>
              <CheckCircle2 size={18} />
              <span>Catalog Ingestion Complete for {successReport.supplier}</span>
            </div>
            <button onClick={() => setSuccessReport(null)} className="btn-ghost" style={{ padding: '2px' }}>
              <X size={14} />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', background: 'var(--bg-surface)', padding: '12px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-subtle)' }}>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Total Items Ingested</div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>{successReport.totalSubmitted}</div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Auto-Matched to Catalog</div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--forest-bright)' }}>{successReport.autoConfirmedCount}</div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>New Products Created</div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--copper-bright)' }}>{successReport.createdNewCount}</div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Sent to Review Queue</div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--amber-bright)' }}>{successReport.reviewQueueCount}</div>
            </div>
          </div>

          {successReport.reviewQueueCount > 0 && (
            <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                💡 <strong>{successReport.reviewQueueCount} items</strong> have subtle variations and are waiting in the <strong>Match Review Queue</strong> for confirmation.
              </span>
              {onNavigateQueue && (
                <button onClick={onNavigateQueue} className="btn-primary" style={{ fontSize: '12px', padding: '5px 12px' }}>
                  Open Review Queue <ArrowRight size={13} />
                </button>
              )}
            </div>
          )}
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
          padding: '36px 24px',
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
      {pendingFiles.map((pf) => {
        const isPreviewing = previewFileId === pf.id;
        const validItemCount = pf.dataRows.filter((r) => {
          const name = String(r[pf.mapping.name] || r[pf.mapping.sku] || "").trim();
          const price = parsePriceValue(r[pf.mapping.price]);
          return name && !isNaN(price) && price >= 0;
        }).length;

        return (
          <div key={pf.id} className="panel" style={{ padding: '18px 20px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>
                  {pf.supplierName} · {pf.sheetName}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {pf.dataRows.length} total rows detected · <strong>{validItemCount} valid products ready to import</strong> ({pf.currency})
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  onClick={() => setPreviewFileId(isPreviewing ? null : pf.id)}
                  className="btn-ghost"
                  style={{ fontSize: '12px', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Eye size={13} /> {isPreviewing ? 'Hide Preview' : 'Inspect Raw Data'}
                </button>
                <button onClick={() => setPendingFiles((prev) => prev.filter((i) => i.id !== pf.id))} className="btn-ghost" style={{ padding: '4px' }}>
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Header Row Index Adjustment */}
            <div style={{ padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-xs)', marginBottom: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>
                Table Header Row: <strong>Row {pf.headerRowIndex + 1}</strong>
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Change Header Row:</span>
                <select
                  value={pf.headerRowIndex}
                  onChange={(e) => updateHeaderRow(pf.id, parseInt(e.target.value))}
                  style={{ fontSize: '11px', padding: '2px 6px' }}
                >
                  {pf.rawRows.slice(0, 10).map((r, idx) => (
                    <option key={idx} value={idx}>Row {idx + 1}: {r.slice(0, 3).filter(Boolean).join(' | ') || '(empty)'}</option>
                  ))}
                </select>
              </div>
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

            {/* Live Data Preview Table */}
            {isPreviewing && (
              <div style={{ marginBottom: '16px', maxHeight: '220px', overflowY: 'auto', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-xs)' }}>
                <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)' }}>
                      <th style={{ padding: '6px 8px' }}>Row #</th>
                      <th style={{ padding: '6px 8px' }}>Name ({pf.mapping.name || 'unmapped'})</th>
                      <th style={{ padding: '6px 8px' }}>SKU ({pf.mapping.sku || 'unmapped'})</th>
                      <th style={{ padding: '6px 8px' }}>Price ({pf.mapping.price || 'unmapped'})</th>
                      <th style={{ padding: '6px 8px' }}>Stock ({pf.mapping.stock || 'unmapped'})</th>
                      <th style={{ padding: '6px 8px' }}>Parsed Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pf.dataRows.slice(0, 10).map((r, i) => {
                      const pPrice = parsePriceValue(r[pf.mapping.price]);
                      const isValid = !isNaN(pPrice) && pPrice >= 0;
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)', background: isValid ? 'transparent' : 'rgba(239, 68, 68, 0.05)' }}>
                          <td style={{ padding: '6px 8px', color: 'var(--text-muted)' }}>{r.__rowNum}</td>
                          <td style={{ padding: '6px 8px' }}>{String(r[pf.mapping.name] || '-')}</td>
                          <td style={{ padding: '6px 8px' }}>{String(r[pf.mapping.sku] || '-')}</td>
                          <td style={{ padding: '6px 8px' }}>{String(r[pf.mapping.price] || '-')}</td>
                          <td style={{ padding: '6px 8px' }}>{String(r[pf.mapping.stock] || '-')}</td>
                          <td style={{ padding: '6px 8px', fontWeight: 600, color: isValid ? 'var(--forest-bright)' : 'var(--color-danger-text)' }}>
                            {isValid ? `${pf.currency} ${pPrice.toLocaleString()}` : 'Skipped (No Price)'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

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
                    <Check size={14} /> Import {validItemCount} Products
                  </>
                )}
              </button>
            </div>
          </div>
        );
      })}

    </div>
  );
}
