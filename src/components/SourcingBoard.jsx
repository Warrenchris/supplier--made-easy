import { useState, useMemo, useRef, useCallback } from "react";
import * as XLSX from "xlsx";
import {
  Upload, X, ChevronDown, ChevronRight, Search, GitMerge, Scissors,
  TriangleAlert, Boxes, Trash2, Check, ArrowUpDown, FileSpreadsheet, Download,
  Sparkles, Layers, RefreshCw
} from "lucide-react";

const SUPPLIER_BANDS = [
  { fill: "#3DDC97", name: "Emerald" },
  { fill: "#4EA1F7", name: "Sapphire" },
  { fill: "#F5A623", name: "Amber" },
  { fill: "#A78BFA", name: "Purple" },
  { fill: "#E5484D", name: "Coral" },
  { fill: "#B87333", name: "Copper" },
  { fill: "#F2D024", name: "Gold" },
  { fill: "#9CA3AF", name: "Silver" },
];

const NAME_KEYS = ["product", "name", "description", "item", "title", "model name", "product name"];
const SKU_KEYS = ["sku", "code", "part", "model", "mpn", "id", "ean", "upc", "part number", "item #"];
const PRICE_KEYS = ["price", "cost", "wholesale", "unit price", "rrp", "rate", "usd", "kes", "eur", "gbp"];
const STOCK_KEYS = ["stock", "qty", "quantity", "availability", "avail", "inventory", "status", "count", "units"];
const COVER_SHEET_RX = /^(home\s*page|main\s*page|cover|contents|index|welcome|terms|info)$/i;

function normalizeName(s) {
  return String(s || "").trim().toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeSku(s) {
  return String(s || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function parsePrice(raw) {
  if (raw === null || raw === undefined || raw === "") return NaN;
  if (typeof raw === "number") return raw;
  const cleaned = String(raw).replace(/[^0-9.\-]/g, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? NaN : n;
}

function parseStock(raw) {
  if (raw === null || raw === undefined || raw === "") return { tone: "unknown", label: "—" };
  if (typeof raw === "number") return raw > 0 ? { tone: "in", label: `${raw} in stock`, qty: raw } : { tone: "out", label: "Out of stock", qty: 0 };
  const s = String(raw).trim();
  const low = s.toLowerCase();
  if (/^\d+(\.\d+)?$/.test(s)) {
    const n = parseFloat(s);
    return n > 0 ? { tone: "in", label: `${n} in stock`, qty: n } : { tone: "out", label: "Out of stock", qty: 0 };
  }
  if (/back\s*order/.test(low)) return { tone: "back", label: s };
  if (/(out of stock|unavailable|^no$|^0$)/.test(low)) return { tone: "out", label: s };
  if (/(in stock|available|ex-?stock|^yes$|ready)/.test(low)) return { tone: "in", label: s };
  return { tone: "unknown", label: s };
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

function tokenSet(name) { return new Set(normalizeName(name).split(" ").filter((t) => t.length > 1)); }
function jaccard(a, b) {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0; for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

function fmtPrice(n, currency) {
  if (isNaN(n)) return "—";
  const num = n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return currency ? `${num} ${currency}` : num;
}

let uid = 0;
const nextId = (p) => `${p}_${++uid}_${Math.random().toString(36).slice(2, 7)}`;

export default function SourcingBoard() {
  const [suppliers, setSuppliers] = useState([]);
  const [sheetPickers, setSheetPickers] = useState([]);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [items, setItems] = useState([]);
  const [mergeOverrides, setMergeOverrides] = useState({});
  const [dismissedSuggestions, setDismissedSuggestions] = useState({});
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const [expanded, setExpanded] = useState({});
  const [dragActive, setDragActive] = useState(false);
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
          setSheetPickers((prev) => [...prev, { id: nextId("wb"), fileName: file.name, supplierName: baseName, currency: "USD", sheets }]);
        } catch (err) {
          setSheetPickers((prev) => [...prev, { id: nextId("wb"), fileName: file.name, supplierName: file.name, currency: "", sheets: [], error: "Couldn't read file format. Try re-saving as .xlsx or .csv." }]);
        }
      };
      reader.readAsArrayBuffer(file);
    });
  }, []);

  const loadDemoData = () => {
    const demoSuppliers = [
      { id: "sup_demo_1", name: "Global Tech Wholesalers", currency: "USD", colorIdx: 0 },
      { id: "sup_demo_2", name: "Apex Electronics Hub", currency: "USD", colorIdx: 1 },
      { id: "sup_demo_3", name: "Pacific Direct Sourcing", currency: "USD", colorIdx: 2 },
    ];

    const demoItems = [
      // Product 1: Dell XPS 15
      { id: nextId("it"), supplierId: "sup_demo_1", name: "Dell XPS 15 Laptop i7 16GB 512GB", sku: "XPS15-9530-01", price: 1450.00, stockRaw: "15", stock: parseStock(15), specs: "Core i7 • 16GB RAM • 512GB NVMe SSD" },
      { id: nextId("it"), supplierId: "sup_demo_2", name: "Dell XPS 15 9530 Core i7-13700H 16/512GB", sku: "XPS159530", price: 1399.99, stockRaw: "In Stock", stock: parseStock("In Stock"), specs: "15.6 in FHD+ • Intel Iris Xe" },
      { id: nextId("it"), supplierId: "sup_demo_3", name: "Dell Laptop XPS 15 i7 16G 512G Gray", sku: "DELL-XPS-15-I7", price: 1420.50, stockRaw: "3 units", stock: parseStock(3), specs: "Gray Finish • 1 Year Warranty" },

      // Product 2: MacBook Pro 14 M3
      { id: nextId("it"), supplierId: "sup_demo_1", name: "Apple MacBook Pro 14 M3 8-Core 8GB 512GB Space Gray", sku: "MRX33LL/A", price: 1599.00, stockRaw: "8", stock: parseStock(8), specs: "M3 Chip • 8-Core CPU • 10-Core GPU" },
      { id: nextId("it"), supplierId: "sup_demo_2", name: "MacBook Pro 14'' M3 512GB - Space Gray", sku: "MBP14-M3-512", price: 1549.00, stockRaw: "Available", stock: parseStock("Available"), specs: "Liquid Retina XDR Display" },

      // Product 3: Samsung 4K Monitor 32"
      { id: nextId("it"), supplierId: "sup_demo_2", name: "Samsung ViewFinity S8 32-Inch 4K UHD Monitor", sku: "LS32B800PXNXGO", price: 429.99, stockRaw: "Out of Stock", stock: parseStock("Out of Stock"), specs: "IPS Panel • USB-C Hub • HDR400" },
      { id: nextId("it"), supplierId: "sup_demo_3", name: "Samsung 32\" 4K UHD ViewFinity S8 Monitor", sku: "SAMSUNG-32-4K", price: 395.00, stockRaw: "25 in stock", stock: parseStock(25), specs: "98% DCI-P3 • Ergonomic Stand" },

      // Product 4: Logitech MX Master 3S
      { id: nextId("it"), supplierId: "sup_demo_1", name: "Logitech MX Master 3S Wireless Performance Mouse Black", sku: "910-006556", price: 99.99, stockRaw: "50+", stock: parseStock(50), specs: "8K DPI Track Anywhere • Quiet Clicks" },
      { id: nextId("it"), supplierId: "sup_demo_2", name: "Logitech MX Master 3S Mouse Graphite", sku: "MX-3S-GRAPHITE", price: 89.95, stockRaw: "In Stock", stock: parseStock("In Stock"), specs: "Logi Options+ Compatible" },
      { id: nextId("it"), supplierId: "sup_demo_3", name: "Logitech Wireless Mouse MX Master 3S", sku: "LOGI-MX3S-BLK", price: 94.00, stockRaw: "Backorder", stock: parseStock("Backorder"), specs: "USB-C Quick Charging" },
    ];

    setSuppliers(demoSuppliers);
    setItems(demoItems);
  };

  const updateSheetPicker = (id, patch) => setSheetPickers((prev) => prev.map((sp) => (sp.id === id ? { ...sp, ...patch } : sp)));
  const toggleSheet = (spId, sheetName) => setSheetPickers((prev) => prev.map((sp) => sp.id !== spId ? sp : {
    ...sp, sheets: sp.sheets.map((s) => s.name === sheetName ? { ...s, checked: !s.checked } : s),
  }));
  const discardSheetPicker = (id) => setSheetPickers((prev) => prev.filter((sp) => sp.id !== id));

  const confirmSheetPicker = (sp) => {
    const chosen = sp.sheets.filter((s) => s.checked);
    const newPending = chosen.map((s) => {
      const headerRowIndex = detectHeaderRow(s.rawRows);
      const headers = buildHeaders(s.rawRows, headerRowIndex);
      const dataRows = buildDataRows(s.rawRows, headerRowIndex, headers);
      return {
        id: nextId("pf"), fileName: sp.fileName, sheetName: s.name,
        supplierName: sp.supplierName, currency: sp.currency,
        rawRows: s.rawRows, headerRowIndex,
        mapping: guessMapping(headers, dataRows),
      };
    });
    setPendingFiles((prev) => [...prev, ...newPending]);
    discardSheetPicker(sp.id);
  };

  const updatePending = (id, patch) => setPendingFiles((prev) => prev.map((pf) => (pf.id === id ? { ...pf, ...patch } : pf)));
  const updatePendingMapping = (id, patch) => setPendingFiles((prev) => prev.map((pf) => (pf.id === id ? { ...pf, mapping: { ...pf.mapping, ...patch } } : pf)));
  const updateHeaderRow = (id, newIdx) => setPendingFiles((prev) => prev.map((pf) => {
    if (pf.id !== id) return pf;
    const headers = buildHeaders(pf.rawRows, newIdx);
    const dataRows = buildDataRows(pf.rawRows, newIdx, headers);
    return { ...pf, headerRowIndex: newIdx, mapping: guessMapping(headers, dataRows) };
  }));
  const discardPending = (id) => setPendingFiles((prev) => prev.filter((pf) => pf.id !== id));

  const confirmPending = (pf) => {
    if (!pf.mapping || !pf.mapping.name || !pf.mapping.price) return;
    const headers = buildHeaders(pf.rawRows, pf.headerRowIndex);
    const dataRows = buildDataRows(pf.rawRows, pf.headerRowIndex, headers);
    const colorIdx = suppliers.length % SUPPLIER_BANDS.length;
    const supplierId = nextId("sup");
    const supplier = { id: supplierId, name: pf.supplierName.trim() || pf.fileName, currency: pf.currency.trim(), colorIdx };
    const newItems = dataRows.map((row) => {
      const name = String(row[pf.mapping.name] ?? "").trim();
      const price = parsePrice(row[pf.mapping.price]);
      if (!name || isNaN(price)) return null;
      const sku = pf.mapping.sku ? String(row[pf.mapping.sku] ?? "").trim() : "";
      const stockRaw = pf.mapping.stock ? row[pf.mapping.stock] : "";
      const colSpecs = pf.mapping.specs.map((col) => {
        const v = row[col]; return v !== undefined && v !== "" ? `${col}: ${v}` : null;
      }).filter(Boolean).join("  •  ");
      const specs = [pf.sheetName ? `Category: ${pf.sheetName}` : null, colSpecs || null].filter(Boolean).join("  •  ");
      return { id: nextId("it"), supplierId, name, sku, price, stockRaw, stock: parseStock(stockRaw), specs };
    }).filter(Boolean);

    setSuppliers((prev) => [...prev, supplier]);
    setItems((prev) => [...prev, ...newItems]);
    discardPending(pf.id);
  };

  const removeSupplier = (supplierId) => {
    setSuppliers((prev) => prev.filter((s) => s.id !== supplierId));
    setItems((prev) => prev.filter((it) => it.supplierId !== supplierId));
  };

  const autoKey = (item) => { const sk = normalizeSku(item.sku); return sk ? `sku:${sk}` : `name:${normalizeName(item.name)}`; };
  const groupKeyOf = (item) => mergeOverrides[item.id] || autoKey(item);

  const groups = useMemo(() => {
    const map = new Map();
    items.forEach((it) => { const key = groupKeyOf(it); if (!map.has(key)) map.set(key, []); map.get(key).push(it); });
    return Array.from(map.entries()).map(([key, its]) => {
      const prices = its.map((i) => i.price).filter((p) => !isNaN(p));
      const supplierIds = new Set(its.map((i) => i.supplierId));
      const name = its.reduce((longest, i) => (i.name.length > longest.length ? i.name : longest), its[0].name);
      const skus = Array.from(new Set(its.map((i) => i.sku).filter(Boolean)));
      return { key, items: its, supplierCount: supplierIds.size, minPrice: prices.length ? Math.min(...prices) : NaN, maxPrice: prices.length ? Math.max(...prices) : NaN, name, skus };
    });
  }, [items, mergeOverrides]);

  const filteredSorted = useMemo(() => {
    const q = normalizeName(search);
    let list = groups.filter((g) => !q || normalizeName(g.name).includes(q) || g.skus.some((s) => normalizeSku(s).includes(normalizeSku(q))));
    list = [...list];
    if (sortBy === "name") list.sort((a, b) => a.name.localeCompare(b.name));
    else if (sortBy === "price") list.sort((a, b) => (a.minPrice || Infinity) - (b.minPrice || Infinity));
    else if (sortBy === "spread") list.sort((a, b) => (b.maxPrice - b.minPrice || 0) - (a.maxPrice - a.minPrice || 0));
    else if (sortBy === "suppliers") list.sort((a, b) => b.supplierCount - a.supplierCount);
    return list;
  }, [groups, search, sortBy]);

  const suggestions = useMemo(() => {
    const singles = groups.filter((g) => g.items.length === 1);
    const out = [];
    for (let i = 0; i < singles.length; i++) {
      for (let j = i + 1; j < singles.length; j++) {
        const a = singles[i], b = singles[j];
        if (a.items[0].supplierId === b.items[0].supplierId) continue;
        const pairKey = [a.key, b.key].sort().join("|");
        if (dismissedSuggestions[pairKey]) continue;
        const sim = jaccard(tokenSet(a.name), tokenSet(b.name));
        if (sim >= 0.5) out.push({ pairKey, a, b, sim });
      }
    }
    out.sort((x, y) => y.sim - x.sim);
    return out.slice(0, 12);
  }, [groups, dismissedSuggestions]);

  const mergePair = (a, b) => { const targetKey = a.key; setMergeOverrides((prev) => { const next = { ...prev }; b.items.forEach((it) => { next[it.id] = targetKey; }); return next; }); };
  const splitItem = (item) => setMergeOverrides((prev) => ({ ...prev, [item.id]: `solo:${item.id}` }));
  const dismissSuggestion = (pairKey) => setDismissedSuggestions((prev) => ({ ...prev, [pairKey]: true }));
  const toggleExpand = (key) => setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  const stats = useMemo(() => ({ items: items.length, groups: groups.length, matched: groups.filter((g) => g.supplierCount > 1).length, suppliers: suppliers.length }), [groups, items, suppliers]);
  const supplierById = (id) => suppliers.find((s) => s.id === id);

  const exportComparison = () => {
    const exportRows = [];
    groups.forEach((g) => {
      g.items.forEach((it) => {
        const sup = supplierById(it.supplierId);
        exportRows.push({
          "Product Group": g.name,
          "Supplier Name": sup ? sup.name : "",
          "SKU": it.sku,
          "Price": it.price,
          "Currency": sup ? sup.currency : "",
          "Is Lowest Price": it.price === g.minPrice ? "YES" : "NO",
          "Availability": it.stock.label,
          "Specs & Notes": it.specs
        });
      });
    });

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sourcing Comparison");
    XLSX.writeFile(workbook, `Supplier_Comparison_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const bg = "#0f1117", panel = "#181b24", panel2 = "#202430", border = "#2b303d";
  const text = "#f0f3f8", textDim = "#949eb2", accent = "#2dd4bf", amber = "#f59e0b", danger = "#f43f5e";

  const styles = {
    page: { fontFamily: "'Inter', sans-serif", color: text, background: bg, padding: "28px", borderRadius: "16px", maxWidth: "1240px", margin: "0 auto" },
    mono: { fontFamily: "'IBM Plex Mono', monospace" },
    h1: { fontSize: "24px", fontWeight: 700, margin: 0, letterSpacing: "-0.02em", background: "linear-gradient(135deg, #ffffff 0%, #a5b4fc 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" },
    sub: { fontSize: "14px", color: textDim, marginTop: "4px" },
    panel: { background: panel, border: `1px solid ${border}`, borderRadius: "12px", boxShadow: "0 4px 20px rgba(0,0,0,0.2)" },
    input: { background: panel2, border: `1px solid ${border}`, borderRadius: "8px", color: text, padding: "8px 12px", fontSize: "13px", outline: "none", fontFamily: "inherit" },
    button: { background: panel2, border: `1px solid ${border}`, borderRadius: "8px", color: text, padding: "8px 14px", fontSize: "13px", cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: "6px" },
    buttonPrimary: { background: accent, border: `1px solid ${accent}`, color: "#042f2e", fontWeight: 600 },
  };

  return (
    <div style={styles.page}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h1 style={styles.h1}>Sourcing Board</h1>
          <p style={styles.sub}>Compare supplier pricelists, stock availability, and specifications side-by-side with intelligent matching.</p>
        </div>
        <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
          {items.length === 0 && (
            <button style={{ ...styles.button, ...styles.buttonPrimary }} onClick={loadDemoData}>
              <Sparkles size={16} /> Load Demo Datasets
            </button>
          )}
          {items.length > 0 && (
            <>
              <button style={styles.button} onClick={exportComparison} title="Export current comparison view to Excel file">
                <Download size={15} /> Export Excel
              </button>
              <button style={styles.button} onClick={loadDemoData} title="Add sample suppliers to test matching">
                <RefreshCw size={15} /> Reset Demo Data
              </button>
            </>
          )}
          {suppliers.length > 0 && (
            <div style={{ display: "flex", gap: "16px", background: panel, border: `1px solid ${border}`, padding: "8px 16px", borderRadius: "10px" }}>
              {[["Items", stats.items], ["Products", stats.groups], ["Matched", stats.matched], ["Suppliers", stats.suppliers]].map(([label, val]) => (
                <div key={label} style={{ textAlign: "center" }}>
                  <div style={{ ...styles.mono, fontSize: "16px", fontWeight: 600, color: accent }}>{val}</div>
                  <div style={{ fontSize: "10px", color: textDim, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Upload Zone */}
      <div
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => { e.preventDefault(); setDragActive(false); handleFiles(e.dataTransfer.files); }}
        style={{
          ...styles.panel,
          borderStyle: "dashed",
          borderColor: dragActive ? accent : border,
          padding: "26px",
          textAlign: "center",
          cursor: "pointer",
          marginBottom: "20px",
          background: dragActive ? "rgba(45, 212, 191, 0.05)" : panel,
          transition: "all 0.2s ease"
        }}
      >
        <Upload size={24} color={dragActive ? accent : textDim} style={{ marginBottom: "8px" }} />
        <div style={{ fontSize: "14px", fontWeight: 500, color: text }}>Drop supplier pricelists here, or click to browse</div>
        <div style={{ fontSize: "12px", color: textDim, marginTop: "4px" }}>Supports <strong>.xlsx, .xls, .csv</strong> files with multi-sheet detection & smart column mapping</div>
        <input ref={fileInputRef} type="file" multiple accept=".csv,.xlsx,.xls" hidden onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }} />
      </div>

      {/* Sheet Picker Modal Cards */}
      {sheetPickers.map((sp) => (
        <div key={sp.id} style={{ ...styles.panel, padding: "18px", marginBottom: "16px" }} className="animate-fade-in">
          {sp.error ? (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", gap: "8px", alignItems: "center", color: danger, fontSize: "13px" }}><TriangleAlert size={16} /> {sp.fileName} — {sp.error}</div>
              <button style={styles.button} onClick={() => discardSheetPicker(sp.id)}><X size={14} /></button>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px", gap: "12px", flexWrap: "wrap" }}>
                <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "13px", color: textDim }}>{sp.fileName} · {sp.sheets.length} sheets</span>
                  <input style={{ ...styles.input, width: "190px" }} placeholder="Supplier name" value={sp.supplierName} onChange={(e) => updateSheetPicker(sp.id, { supplierName: e.target.value })} />
                  <input style={{ ...styles.input, width: "100px" }} placeholder="Currency" value={sp.currency} onChange={(e) => updateSheetPicker(sp.id, { currency: e.target.value })} />
                </div>
                <button style={styles.button} onClick={() => discardSheetPicker(sp.id)}><X size={14} /> Discard</button>
              </div>
              <div style={{ fontSize: "12px", color: textDim, marginBottom: "10px" }}>Select the product sheets to import:</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "8px", marginBottom: "16px", maxHeight: "220px", overflowY: "auto" }}>
                {sp.sheets.map((s) => (
                  <label key={s.name} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", background: panel2, borderRadius: "8px", padding: "8px 10px", cursor: "pointer", border: `1px solid ${s.checked ? accent : "transparent"}` }}>
                    <input type="checkbox" style={{ accentColor: accent }} checked={s.checked} onChange={() => toggleSheet(sp.id, s.name)} />
                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>
                    <span style={{ color: textDim, ...styles.mono, fontSize: "11px" }}>{s.rawRows.length} rows</span>
                  </label>
                ))}
              </div>
              <button style={{ ...styles.button, ...styles.buttonPrimary, opacity: sp.sheets.some((s) => s.checked) ? 1 : 0.5 }} disabled={!sp.sheets.some((s) => s.checked)} onClick={() => confirmSheetPicker(sp)}>
                <Check size={14} /> Continue with {sp.sheets.filter((s) => s.checked).length} selected sheet{sp.sheets.filter((s) => s.checked).length === 1 ? "" : "s"}
              </button>
            </>
          )}
        </div>
      ))}

      {/* Column Mapping Modal Cards */}
      {pendingFiles.map((pf) => {
        const headers = buildHeaders(pf.rawRows, pf.headerRowIndex);
        const preview = headers.slice(0, 5).join("  |  ") + (headers.length > 5 ? "  |  …" : "");
        return (
          <div key={pf.id} style={{ ...styles.panel, padding: "18px", marginBottom: "16px" }} className="animate-fade-in">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px", gap: "12px", flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "12px", color: accent, background: "rgba(45, 212, 191, 0.1)", borderRadius: "6px", padding: "4px 8px" }}>
                  <FileSpreadsheet size={13} /> {pf.sheetName}
                </span>
                <input style={{ ...styles.input, width: "190px" }} placeholder="Supplier name" value={pf.supplierName} onChange={(e) => updatePending(pf.id, { supplierName: e.target.value })} />
                <input style={{ ...styles.input, width: "100px" }} placeholder="Currency" value={pf.currency} onChange={(e) => updatePending(pf.id, { currency: e.target.value })} />
              </div>
              <button style={styles.button} onClick={() => discardPending(pf.id)}><X size={14} /> Discard</button>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
              <label style={{ fontSize: "12px", color: textDim }}>Header Row Index</label>
              <input type="number" min={0} max={Math.max(0, pf.rawRows.length - 1)} value={pf.headerRowIndex}
                style={{ ...styles.input, width: "70px" }}
                onChange={(e) => updateHeaderRow(pf.id, Math.max(0, Math.min(pf.rawRows.length - 1, parseInt(e.target.value) || 0)))} />
              <span style={{ ...styles.mono, fontSize: "11px", color: textDim, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Preview: {preview}</span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "12px", marginBottom: "14px" }}>
              {[["name", "Product Name *"], ["sku", "SKU / Code"], ["price", "Price *"], ["stock", "Stock / Availability"]].map(([field, label]) => (
                <div key={field}>
                  <label style={{ fontSize: "11px", color: textDim, display: "block", marginBottom: "4px" }}>{label}</label>
                  <select style={{ ...styles.input, width: "100%" }} value={pf.mapping[field]} onChange={(e) => updatePendingMapping(pf.id, { [field]: e.target.value })}>
                    <option value="">— select column —</option>
                    {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              ))}
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ fontSize: "11px", color: textDim, display: "block", marginBottom: "6px" }}>Additional Spec Columns (optional)</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {headers.map((h) => {
                  const active = pf.mapping.specs.includes(h);
                  return (
                    <button key={h} onClick={() => { const specs = active ? pf.mapping.specs.filter((s) => s !== h) : [...pf.mapping.specs, h]; updatePendingMapping(pf.id, { specs }); }}
                      style={{ ...styles.button, padding: "4px 10px", fontSize: "12px", background: active ? "rgba(45, 212, 191, 0.15)" : panel2, borderColor: active ? accent : border, color: active ? accent : textDim }}>{h}</button>
                  );
                })}
              </div>
            </div>

            <button style={{ ...styles.button, ...styles.buttonPrimary, opacity: (!pf.mapping.name || !pf.mapping.price) ? 0.5 : 1 }} disabled={!pf.mapping.name || !pf.mapping.price} onClick={() => confirmPending(pf)}>
              <Check size={14} /> Import to Comparison Board
            </button>
            {(!pf.mapping.name || !pf.mapping.price) && <span style={{ fontSize: "12px", color: textDim, marginLeft: "12px" }}>Select at least Product Name and Price to proceed</span>}
          </div>
        );
      })}

      {/* Supplier Legend */}
      {suppliers.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginBottom: "20px" }}>
          {suppliers.map((s) => {
            const band = SUPPLIER_BANDS[s.colorIdx % SUPPLIER_BANDS.length];
            const count = items.filter((it) => it.supplierId === s.id).length;
            return (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: "8px", ...styles.panel, padding: "6px 12px" }}>
                <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: band.fill, display: "inline-block" }} />
                <span style={{ fontSize: "13px", fontWeight: 500 }}>{s.name}</span>
                <span style={{ fontSize: "11px", color: textDim, ...styles.mono }}>({count} items{s.currency ? ` · ${s.currency}` : ""})</span>
                <button onClick={() => removeSupplier(s.id)} title="Remove supplier" style={{ background: "none", border: "none", cursor: "pointer", color: textDim, display: "flex", marginLeft: "4px" }}><Trash2 size={13} /></button>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty State */}
      {items.length === 0 && pendingFiles.length === 0 && sheetPickers.length === 0 && (
        <div style={{ ...styles.panel, padding: "50px 20px", textAlign: "center" }}>
          <Boxes size={36} color={textDim} style={{ marginBottom: "12px" }} />
          <div style={{ fontSize: "16px", fontWeight: 600, marginBottom: "6px" }}>No Supplier Pricelists Imported Yet</div>
          <div style={{ fontSize: "13px", color: textDim, maxWidth: "480px", margin: "0 auto 20px auto" }}>
            Drop Excel or CSV pricelists into the box above, or click below to explore a pre-populated demo comparison.
          </div>
          <button style={{ ...styles.button, ...styles.buttonPrimary }} onClick={loadDemoData}>
            <Sparkles size={16} /> Load Demo Datasets
          </button>
        </div>
      )}

      {/* Main Board Comparison View */}
      {items.length > 0 && (
        <>
          <div style={{ display: "flex", gap: "12px", marginBottom: "16px", flexWrap: "wrap" }}>
            <div style={{ position: "relative", flex: "1", minWidth: "240px" }}>
              <Search size={15} color={textDim} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }} />
              <input style={{ ...styles.input, width: "100%", paddingLeft: "34px" }} placeholder="Search by product name or SKU..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <select style={styles.input} value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="name">Sort by: Name (A-Z)</option>
              <option value="price">Sort by: Lowest Price First</option>
              <option value="spread">Sort by: Widest Price Gap</option>
              <option value="suppliers">Sort by: Most Supplier Options</option>
            </select>
          </div>

          {/* AI / Token Match Suggestions */}
          {suggestions.length > 0 && (
            <div style={{ ...styles.panel, padding: "14px 16px", marginBottom: "18px", borderColor: "rgba(45, 212, 191, 0.3)" }}>
              <div style={{ fontSize: "13px", color: accent, fontWeight: 500, marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
                <GitMerge size={15} /> Suggested Product Merges ({suggestions.length} matches detected)
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {suggestions.map((s) => (
                  <div key={s.pairKey} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", fontSize: "12px", padding: "8px 12px", background: panel2, borderRadius: "8px", flexWrap: "wrap" }}>
                    <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 500 }}>{s.a.name.slice(0, 50)}</span>
                      <ArrowUpDown size={12} color={textDim} />
                      <span style={{ fontWeight: 500 }}>{s.b.name.slice(0, 50)}</span>
                      <span style={{ color: accent, ...styles.mono, fontSize: "11px", background: "rgba(45, 212, 191, 0.1)", padding: "2px 6px", borderRadius: "4px" }}>{Math.round(s.sim * 100)}% match</span>
                    </div>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button style={{ ...styles.button, ...styles.buttonPrimary, padding: "4px 10px", fontSize: "11px" }} onClick={() => mergePair(s.a, s.b)}><GitMerge size={12} /> Merge Products</button>
                      <button style={{ ...styles.button, padding: "4px 8px", fontSize: "11px" }} onClick={() => dismissSuggestion(s.pairKey)}><X size={12} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Comparison Table */}
          <div style={{ ...styles.panel, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "30px 2.2fr 1fr 1.4fr 1.2fr", gap: "12px", padding: "12px 16px", fontSize: "11px", color: textDim, textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${border}`, background: panel2 }}>
              <div></div><div>Product Description</div><div>Suppliers</div><div>Price Range</div><div>Availability</div>
            </div>
            {filteredSorted.length === 0 && <div style={{ padding: "24px 16px", fontSize: "13px", color: textDim }}>No products found matching your search.</div>}
            {filteredSorted.map((g) => {
              const isOpen = !!expanded[g.key];
              return (
                <div key={g.key}>
                  <div className="sb-row" onClick={() => toggleExpand(g.key)} style={{ display: "grid", gridTemplateColumns: "30px 2.2fr 1fr 1.4fr 1.2fr", gap: "12px", padding: "12px 16px", borderBottom: `1px solid ${border}`, cursor: "pointer", alignItems: "center", transition: "background 0.15s ease" }}>
                    <div style={{ color: textDim }}>{isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</div>
                    <div>
                      <div style={{ fontSize: "14px", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "450px" }} title={g.name}>{g.name}</div>
                      {g.skus.length > 0 && <div style={{ fontSize: "11px", color: textDim, ...styles.mono, marginTop: "2px" }}>SKU: {g.skus.join(" / ")}</div>}
                    </div>
                    <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                      {Array.from(new Set(g.items.map((i) => i.supplierId))).map((sid) => {
                        const s = supplierById(sid); if (!s) return null;
                        const band = SUPPLIER_BANDS[s.colorIdx % SUPPLIER_BANDS.length];
                        return <span key={sid} title={s.name} style={{ width: "10px", height: "10px", borderRadius: "50%", background: band.fill, display: "inline-block" }} />;
                      })}
                      {g.supplierCount === 1 && <span style={{ fontSize: "11px", color: amber, display: "inline-flex", alignItems: "center", gap: "3px" }}><TriangleAlert size={12} /> Single source</span>}
                    </div>
                    <div style={{ ...styles.mono, fontSize: "14px" }}>
                      {g.minPrice === g.maxPrice || isNaN(g.maxPrice)
                        ? <span style={{ color: accent, fontWeight: 600 }}>{fmtPrice(g.minPrice, supplierById(g.items[0].supplierId)?.currency)}</span>
                        : <><span style={{ color: accent, fontWeight: 600 }}>{fmtPrice(g.minPrice)}</span><span style={{ color: textDim }}> – {fmtPrice(g.maxPrice)}</span></>}
                    </div>
                    <div>
                      {(() => {
                        const tones = g.items.map((i) => i.stock.tone);
                        if (tones.includes("in")) return <span style={{ fontSize: "12px", color: "#3DDC97", fontWeight: 500 }}>● In Stock</span>;
                        if (tones.includes("back")) return <span style={{ fontSize: "12px", color: amber, fontWeight: 500 }}>● Backorder</span>;
                        if (tones.every((t) => t === "out")) return <span style={{ fontSize: "12px", color: danger, fontWeight: 500 }}>● Out of Stock</span>;
                        return <span style={{ fontSize: "12px", color: textDim }}>● Unknown</span>;
                      })()}
                    </div>
                  </div>
                  {isOpen && (
                    <div style={{ background: "#13161f", borderBottom: `1px solid ${border}` }} className="animate-fade-in">
                      {g.items.map((it) => {
                        const s = supplierById(it.supplierId);
                        const band = s ? SUPPLIER_BANDS[s.colorIdx % SUPPLIER_BANDS.length] : { fill: "#666" };
                        const isMin = it.price === g.minPrice && !isNaN(it.price);
                        const toneColor = it.stock.tone === "in" ? "#3DDC97" : it.stock.tone === "out" ? danger : it.stock.tone === "back" ? amber : textDim;
                        return (
                          <div key={it.id} style={{ display: "grid", gridTemplateColumns: "30px 2.2fr 1fr 1.4fr 1.2fr", gap: "12px", padding: "10px 16px 10px 42px", alignItems: "center", fontSize: "13px", borderTop: "1px rgba(255,255,255,0.03) solid" }}>
                            <div></div>
                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: band.fill }} />
                                <span style={{ color: text, fontWeight: 500 }}>{s?.name}</span>
                                {isMin && <span style={{ fontSize: "10px", background: "rgba(45, 212, 191, 0.15)", color: accent, padding: "1px 6px", borderRadius: "4px", fontWeight: 600 }}>BEST PRICE</span>}
                              </div>
                              {it.specs && <div style={{ color: textDim, fontSize: "11px", marginTop: "3px" }}>{it.specs}</div>}
                            </div>
                            <div></div>
                            <div style={{ ...styles.mono, color: isMin ? accent : text, fontWeight: isMin ? 600 : 400 }}>{fmtPrice(it.price, s?.currency)}</div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                              <span style={{ color: toneColor, fontSize: "12px" }}>{it.stock.label}</span>
                              {g.items.length > 1 && (
                                <button title="Split item into standalone product group" onClick={() => splitItem(it)} style={{ background: "none", border: "none", cursor: "pointer", color: textDim, display: "flex" }}><Scissors size={13} /></button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
