import { useState, useEffect, useMemo } from 'react';
import { 
  Search, ChevronDown, ChevronRight, Download, 
  Layers, Target, Eye, Filter, ArrowUpDown, 
  CheckCircle2, AlertCircle, RefreshCw, Sparkles, ExternalLink
} from 'lucide-react';
import ProductDetailModal from './ProductDetailModal';
import * as XLSX from 'xlsx';

export default function ComparisonBoard({ onOptimizeProduct }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [stockOnly, setStockOnly] = useState(false);
  const [sortBy, setSortBy] = useState('score');
  const [sortAsc, setSortAsc] = useState(false);
  const [expanded, setExpanded] = useState({});
  const [selectedProduct, setSelectedProduct] = useState(null);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/canonical-products');
      const data = await res.json();
      setProducts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch canonical products:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const toggleExpand = (id) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  // Extract unique categories
  const categories = useMemo(() => {
    const set = new Set();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return ['ALL', ...Array.from(set)];
  }, [products]);

  // Filtering & Sorting
  const filteredSorted = useMemo(() => {
    const q = search.toLowerCase().trim();
    let list = products.filter((p) => {
      if (selectedCategory !== 'ALL' && p.category !== selectedCategory) return false;
      
      const totalStock = (p.offers || []).reduce((sum, o) => sum + (o.quantity_available || o.stock_qty || 0), 0);
      if (stockOnly && totalStock <= 0) return false;

      if (!q) return true;
      const nameMatch = (p.canonical_name || '').toLowerCase().includes(q);
      const brandMatch = (p.brand || '').toLowerCase().includes(q);
      const modelMatch = (p.model_number || '').toLowerCase().includes(q);
      const skuMatch = (p.offers || []).some((o) => (o.supplier_sku || o.sku || '').toLowerCase().includes(q));
      return nameMatch || brandMatch || modelMatch || skuMatch;
    });

    list = [...list];
    list.sort((a, b) => {
      let valA, valB;
      if (sortBy === 'name') {
        valA = a.canonical_name || '';
        valB = b.canonical_name || '';
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      } else if (sortBy === 'score') {
        valA = a.recommendedOffer?.scoreInfo?.totalScore || 0;
        valB = b.recommendedOffer?.scoreInfo?.totalScore || 0;
      } else if (sortBy === 'price') {
        valA = a.recommendedOffer?.cost_in_base_currency || a.recommendedOffer?.price_in_base_currency || Infinity;
        valB = b.recommendedOffer?.cost_in_base_currency || b.recommendedOffer?.price_in_base_currency || Infinity;
      } else if (sortBy === 'offers') {
        valA = a.offers?.length || 0;
        valB = b.offers?.length || 0;
      }
      return sortAsc ? valA - valB : valB - valA;
    });

    return list;
  }, [products, search, selectedCategory, stockOnly, sortBy, sortAsc]);

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortAsc(!sortAsc);
    } else {
      setSortBy(column);
      setSortAsc(false);
    }
  };

  const exportExcel = () => {
    const rows = [];
    products.forEach((p) => {
      (p.offers || []).forEach((o) => {
        rows.push({
          'Canonical Product': p.canonical_name,
          'Brand': p.brand || 'Generic',
          'Category': p.category || 'Electronics',
          'Model': p.model_number || '',
          'Supplier': o.supplier_name,
          'Supplier SKU': o.supplier_sku || o.sku || '',
          'Cost': o.cost || o.price,
          'Currency': o.currency,
          'Base Cost (KES)': Math.round(o.cost_in_base_currency || o.price_in_base_currency || 0),
          'Stock Quantity': o.quantity_available || o.stock_qty || 0,
          'Stock Status': o.stock_status,
          'Is Recommended': p.recommendedOffer?.id === o.id ? 'YES' : 'NO',
          'Score (100)': o.scoreInfo?.totalScore || ''
        });
      });
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Procurement Matrix');
    XLSX.writeFile(wb, `Procurement_Comparison_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  if (loading) {
    return (
      <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
        <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite', marginBottom: '8px' }} />
        <div>Loading Procurement Comparison Matrix...</div>
      </div>
    );
  }

  return (
    <div className="animate-fade" style={{ maxWidth: '1280px', margin: '0 auto' }}>
      
      {/* ─── Header & Action Bar ─── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--forest-text)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
            Multi-Supplier Sourcing
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Procurement Comparison Matrix
          </h1>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Unified canonical product catalog with automated price normalization and supplier intelligence scoring.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={fetchProducts} className="btn-secondary" style={{ fontSize: '12px' }}>
            <RefreshCw size={14} /> Refresh
          </button>
          <button onClick={exportExcel} className="btn-secondary" style={{ fontSize: '12px' }}>
            <Download size={14} /> Export Matrix (.xlsx)
          </button>
        </div>
      </div>

      {/* ─── Filter & Search Control Strip ─── */}
      <div className="panel" style={{ padding: '12px 16px', marginBottom: '16px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
        
        {/* Search */}
        <div style={{ position: 'relative', flex: 1, minWidth: '260px' }}>
          <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search canonical product, brand, MPN, or SKU..."
            style={{ width: '100%', paddingLeft: '32px', fontSize: '12px' }}
          />
        </div>

        {/* Category Filters */}
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {categories.slice(0, 6).map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              style={{
                fontSize: '11px',
                padding: '5px 10px',
                borderRadius: 'var(--radius-xs)',
                backgroundColor: selectedCategory === cat ? 'var(--forest-primary)' : 'var(--bg-elevated)',
                color: selectedCategory === cat ? '#F7F5EF' : 'var(--text-muted)',
                border: `1px solid ${selectedCategory === cat ? 'var(--forest-hover)' : 'var(--border-subtle)'}`
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* In-Stock Toggle */}
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={stockOnly}
            onChange={(e) => setStockOnly(e.target.checked)}
            style={{ accentColor: 'var(--forest-primary)' }}
          />
          In Stock Only
        </label>
      </div>

      {/* ─── Structured Comparison Table ─── */}
      <div className="panel" style={{ overflow: 'hidden' }}>
        <table className="enterprise-table">
          <thead>
            <tr>
              <th style={{ width: '32px', textAlign: 'center' }}></th>
              <th onClick={() => handleSort('name')} style={{ cursor: 'pointer' }}>
                Canonical Product <ArrowUpDown size={11} style={{ display: 'inline', verticalAlign: 'middle' }} />
              </th>
              <th>Category</th>
              <th onClick={() => handleSort('score')} style={{ cursor: 'pointer' }}>
                Recommended Supplier <ArrowUpDown size={11} style={{ display: 'inline', verticalAlign: 'middle' }} />
              </th>
              <th onClick={() => handleSort('price')} style={{ cursor: 'pointer', textAlign: 'right' }}>
                Best Price (KES) <ArrowUpDown size={11} style={{ display: 'inline', verticalAlign: 'middle' }} />
              </th>
              <th style={{ textAlign: 'center' }}>Offers</th>
              <th style={{ textAlign: 'right' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredSorted.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-muted)' }}>
                  No canonical products match your search and filter criteria.
                </td>
              </tr>
            ) : (
              filteredSorted.map((p) => {
                const isOpen = !!expanded[p.id];
                const rec = p.recommendedOffer;
                const offers = p.offers || [];
                const totalStock = offers.reduce((sum, o) => sum + (o.quantity_available || o.stock_qty || 0), 0);

                return (
                  <>
                    <tr key={p.id} className={isOpen ? 'active' : ''}>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          onClick={() => toggleExpand(p.id)}
                          className="btn-ghost"
                          style={{ padding: '2px 4px' }}
                        >
                          {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                      </td>

                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          {p.canonical_name}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                          {p.model_number ? `Model: ${p.model_number}` : (p.brand || 'Generic')}
                        </div>
                      </td>

                      <td>
                        <span className="badge badge-neutral">{p.category || 'Electronics'}</span>
                      </td>

                      <td>
                        {rec ? (
                          <div>
                            <div style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>
                              {rec.supplier_name}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--forest-bright)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span>Score: {rec.scoreInfo?.totalScore || 'N/A'}/100</span>
                              {rec.scoreInfo?.totalScore >= 85 && <span className="badge badge-forest" style={{ padding: '0 4px', fontSize: '9px' }}>Preferred</span>}
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>No active offers</span>
                        )}
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        {rec ? (
                          <div>
                            <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: '14px' }}>
                              KSh {Math.round(rec.cost_in_base_currency || rec.price_in_base_currency || 0).toLocaleString()}
                            </div>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                              {rec.cost || rec.price} {rec.currency}
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        <span className={`badge ${offers.length > 1 ? 'badge-forest' : 'badge-neutral'}`}>
                          {offers.length} {offers.length === 1 ? 'offer' : 'offers'}
                        </span>
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '4px' }}>
                          <button
                            onClick={() => {
                              if (onOptimizeProduct) onOptimizeProduct(p);
                            }}
                            className="btn-primary"
                            style={{ padding: '4px 8px', fontSize: '11px' }}
                            title="Optimize supplier allocation for this product"
                          >
                            <Target size={12} /> Optimize
                          </button>
                          <button
                            onClick={() => setSelectedProduct(p)}
                            className="btn-secondary"
                            style={{ padding: '4px 8px', fontSize: '11px' }}
                            title="Inspect product specification & supplier matrix"
                          >
                            <Eye size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* ─── Expandable Sub-row: Full Supplier Offers Matrix ─── */}
                    {isOpen && (
                      <tr key={`${p.id}_expanded`} style={{ backgroundColor: 'var(--bg-primary)' }}>
                        <td colSpan={7} style={{ padding: '12px 20px' }}>
                          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
                            Supplier Offer Comparison Matrix ({offers.length} quotes)
                          </div>

                          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                              <thead>
                                <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase' }}>
                                  <th style={{ padding: '8px 12px', textAlign: 'left' }}>Supplier</th>
                                  <th style={{ padding: '8px 12px', textAlign: 'left' }}>Listing / SKU</th>
                                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>Quoted</th>
                                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>Base (KES)</th>
                                  <th style={{ padding: '8px 12px', textAlign: 'center' }}>Stock</th>
                                  <th style={{ padding: '8px 12px', textAlign: 'center' }}>Lead Time</th>
                                  <th style={{ padding: '8px 12px', textAlign: 'center' }}>Score</th>
                                </tr>
                              </thead>
                              <tbody>
                                {offers.map((off) => {
                                  const isRec = rec && rec.id === off.id;
                                  const baseCost = Math.round(off.cost_in_base_currency || off.price_in_base_currency || 0);
                                  const bestCost = rec ? Math.round(rec.cost_in_base_currency || rec.price_in_base_currency || 0) : baseCost;
                                  const spread = baseCost - bestCost;

                                  return (
                                    <tr 
                                      key={off.id}
                                      style={{ 
                                        borderBottom: '1px solid var(--border-subtle)',
                                        backgroundColor: isRec ? 'var(--forest-light)' : 'transparent'
                                      }}
                                    >
                                      <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                        {off.supplier_name}
                                        {isRec && <span className="badge badge-forest" style={{ marginLeft: '6px', fontSize: '9px' }}>Recommended</span>}
                                      </td>
                                      <td style={{ padding: '8px 12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                                        {off.supplier_sku || off.sku || 'N/A'}
                                      </td>
                                      <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                                        {off.cost || off.price} {off.currency}
                                      </td>
                                      <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: isRec ? 700 : 500 }}>
                                        KSh {baseCost.toLocaleString()}
                                        {spread > 0 && (
                                          <span style={{ fontSize: '10px', color: 'var(--color-danger-text)', display: 'block' }}>
                                            +{spread.toLocaleString()}
                                          </span>
                                        )}
                                      </td>
                                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                        <span className={`badge ${off.stock_status === 'in_stock' ? 'badge-success' : 'badge-danger'}`}>
                                          {off.quantity_available || off.stock_qty || 0} units
                                        </span>
                                      </td>
                                      <td style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                        {off.supplier?.avg_delivery_days ? `${off.supplier.avg_delivery_days}d` : '3d'}
                                      </td>
                                      <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600, color: 'var(--forest-bright)', fontFamily: 'var(--font-mono)' }}>
                                        {off.scoreInfo?.totalScore || '—'}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ─── Product Detail Inspector Slide-over / Modal ─── */}
      {selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onUpdate={fetchProducts}
        />
      )}

    </div>
  );
}
