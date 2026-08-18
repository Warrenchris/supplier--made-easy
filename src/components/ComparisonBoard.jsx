import { useState, useEffect, useMemo } from 'react';
import { 
  Search, ChevronDown, ChevronRight, Download, 
  Layers, Target, Eye, Filter, ArrowUpDown, 
  CheckCircle2, AlertCircle, RefreshCw, Sparkles, 
  ExternalLink, X, DollarSign, Award, Clock, Scissors,
  Building2, TrendingDown, TrendingUp
} from 'lucide-react';
import * as XLSX from 'xlsx';
import api from '../services/apiClient';
import { useToast } from '../context/ToastContext';

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
  const [targetSellPrice, setTargetSellPrice] = useState(0);
  const toast = useToast();

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const data = await api.get('/api/canonical-products');
      setProducts(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error(err.message, 'Failed to Load Canonical Catalog');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const toggleExpand = (id) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  // When a product is selected for the right-side inspector, initialize margin calculator price
  const handleOpenInspector = (prod) => {
    setSelectedProduct(prod);
    const rec = prod.recommendedOffer;
    const baseCost = rec ? (rec.cost_in_base_currency || rec.price_in_base_currency || 0) : 0;
    setTargetSellPrice(baseCost > 0 ? Math.round(baseCost * 1.30) : 0);
  };

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

  const handleSplitItem = async (rawListingId) => {
    if (confirm('Split this raw listing out into its own standalone canonical product?')) {
      try {
        const res = await api.post('/api/products/split', { rawListingId });
        toast.success(`Listing split into new standalone product: ${res.newProduct?.canonical_name || 'Created'}`, 'Product Split Successfully');
        fetchProducts();
        setSelectedProduct(null);
      } catch (err) {
        toast.error(err.message, 'Product Split Failed');
      }
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

  // Selected product calculations for the inspector
  const rec = selectedProduct?.recommendedOffer;
  const inspectorCost = rec ? (rec.cost_in_base_currency || rec.price_in_base_currency || 0) : 0;
  const grossProfit = targetSellPrice - inspectorCost;
  const grossMarginPct = targetSellPrice > 0 ? ((grossProfit / targetSellPrice) * 100) : 0;

  return (
    <div className="animate-fade" style={{ maxWidth: '1280px', margin: '0 auto' }}>
      
      {/* ─── Header & Action Bar ─── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--forest-text)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>
            Multi-Supplier Sourcing
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Products & Comparison Matrix
          </h1>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Unified catalog of {products.length} canonical products with side-by-side vendor quotes and immediate optimization triggers.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={fetchProducts} className="btn-secondary" style={{ fontSize: '12px' }}>
            <RefreshCw size={13} /> Refresh
          </button>
          <button onClick={exportExcel} className="btn-secondary" style={{ fontSize: '12px' }}>
            <Download size={13} /> Export Matrix (.xlsx)
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
                Product <ArrowUpDown size={11} style={{ display: 'inline', verticalAlign: 'middle' }} />
              </th>
              <th onClick={() => handleSort('price')} style={{ cursor: 'pointer', textAlign: 'right' }}>
                Best Acquisition (KES) <ArrowUpDown size={11} style={{ display: 'inline', verticalAlign: 'middle' }} />
              </th>
              <th style={{ textAlign: 'center' }}>Stock</th>
              <th onClick={() => handleSort('offers')} style={{ cursor: 'pointer', textAlign: 'center' }}>
                Suppliers <ArrowUpDown size={11} style={{ display: 'inline', verticalAlign: 'middle' }} />
              </th>
              <th style={{ textAlign: 'right' }}>Spread Saving</th>
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
                const recOffer = p.recommendedOffer;
                const offers = p.offers || [];
                const totalStock = offers.reduce((sum, o) => sum + (o.quantity_available || o.stock_qty || 0), 0);

                // Calculate spread saving if multiple suppliers exist
                let spreadSaving = 0;
                if (offers.length >= 2) {
                  const sortedCosts = offers.map((o) => o.cost_in_base_currency || o.price_in_base_currency || 0).sort((a, b) => a - b);
                  spreadSaving = sortedCosts[sortedCosts.length - 1] - sortedCosts[0];
                }

                return (
                  <>
                    <tr 
                      key={p.id} 
                      className={isOpen ? 'active' : ''}
                      style={{ cursor: 'pointer' }}
                      onClick={() => handleOpenInspector(p)}
                    >
                      <td style={{ textAlign: 'center' }} onClick={(e) => { e.stopPropagation(); toggleExpand(p.id); }}>
                        <button
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
                          {p.model_number ? `Model: ${p.model_number}` : (p.brand || 'Generic')} · <span style={{ color: 'var(--text-secondary)' }}>{p.category || 'Electronics'}</span>
                        </div>
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        {recOffer ? (
                          <div>
                            <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: '14px' }}>
                              KSh {Math.round(recOffer.cost_in_base_currency || recOffer.price_in_base_currency || 0).toLocaleString()}
                            </div>
                            <div style={{ fontSize: '10px', color: 'var(--forest-bright)' }}>
                              via {recOffer.supplier_name}
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        <span className={`badge ${totalStock > 0 ? 'badge-success' : 'badge-danger'}`}>
                          {totalStock} units
                        </span>
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        <span className={`badge ${offers.length > 1 ? 'badge-forest' : 'badge-neutral'}`}>
                          {offers.length} {offers.length === 1 ? 'vendor' : 'vendors'}
                        </span>
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        {spreadSaving > 0 ? (
                          <span className="badge badge-recommendation font-mono">
                            KSh {Math.round(spreadSaving).toLocaleString()}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>

                      <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'inline-flex', gap: '4px' }}>
                          <button
                            onClick={() => {
                              if (onOptimizeProduct) onOptimizeProduct(p);
                            }}
                            className="btn-primary"
                            style={{ padding: '4px 8px', fontSize: '11px' }}
                            title="Optimize supplier allocation"
                          >
                            <Target size={12} /> Optimize
                          </button>
                          <button
                            onClick={() => handleOpenInspector(p)}
                            className="btn-secondary"
                            style={{ padding: '4px 8px', fontSize: '11px' }}
                            title="Open Right-Side Product Inspector"
                          >
                            <Eye size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* ─── Expandable Inline Quote Matrix ─── */}
                    {isOpen && (
                      <tr key={`${p.id}_expanded`} style={{ backgroundColor: 'var(--bg-primary)' }}>
                        <td colSpan={7} style={{ padding: '12px 20px' }}>
                          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
                            Supplier Offer Comparison ({offers.length} quotes)
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
                                  const isRec = recOffer && recOffer.id === off.id;
                                  const baseCost = Math.round(off.cost_in_base_currency || off.price_in_base_currency || 0);
                                  const bestCost = recOffer ? Math.round(recOffer.cost_in_base_currency || recOffer.price_in_base_currency || 0) : baseCost;
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

      {/* ─── Signature Right-Side Product Inspector Drawer ─── */}
      {selectedProduct && (
        <div className="drawer-backdrop" onClick={() => setSelectedProduct(null)}>
          <div className="drawer-content" onClick={(e) => e.stopPropagation()}>
            
            {/* Drawer Header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-default)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', background: 'var(--bg-elevated)' }}>
              <div>
                <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--forest-text)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Product Inspector
                </div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', margin: '2px 0 0 0' }}>
                  {selectedProduct.canonical_name}
                </h3>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {selectedProduct.brand || 'Generic'} · {selectedProduct.category || 'Electronics'}
                </div>
              </div>

              <button onClick={() => setSelectedProduct(null)} className="btn-ghost" style={{ padding: '4px' }}>
                <X size={16} />
              </button>
            </div>

            {/* Drawer Body */}
            <div style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* Best Acquisition Highlight */}
              {rec && (
                <div className="panel" style={{ padding: '16px', backgroundColor: 'var(--forest-light)', borderColor: 'var(--forest-border)' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--forest-bright)', textTransform: 'uppercase' }}>
                    Best Acquisition Cost
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                    KSh {Math.round(inspectorCost).toLocaleString()}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    Supplier: <strong>{rec.supplier_name}</strong> · Score: <strong>{rec.scoreInfo?.totalScore || 'N/A'}/100</strong>
                  </div>
                </div>
              )}

              {/* Direct Optimize CTA */}
              <button
                onClick={() => {
                  const target = selectedProduct;
                  setSelectedProduct(null);
                  if (onOptimizeProduct) onOptimizeProduct(target);
                }}
                className="btn-primary"
                style={{ width: '100%', padding: '10px', fontSize: '13px' }}
              >
                <Target size={15} /> Launch Multi-Supplier Optimizer
              </button>

              {/* All Competing Supplier Offers */}
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
                  All Competing Quotes ({(selectedProduct.offers || []).length})
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {(selectedProduct.offers || []).map((off) => {
                    const isRec = rec && rec.id === off.id;
                    const costKES = Math.round(off.cost_in_base_currency || off.price_in_base_currency || 0);

                    return (
                      <div 
                        key={off.id}
                        className="panel"
                        style={{
                          padding: '10px 14px',
                          backgroundColor: isRec ? 'var(--forest-light)' : 'var(--bg-elevated)',
                          borderColor: isRec ? 'var(--forest-border)' : 'var(--border-subtle)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '12px', color: 'var(--text-primary)' }}>
                            {off.supplier_name}
                            {isRec && <span className="badge badge-forest" style={{ marginLeft: '6px', fontSize: '8px' }}>Best</span>}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            Stock: {off.quantity_available || off.stock_qty || 0} units · Lead: {off.supplier?.avg_delivery_days ? `${off.supplier.avg_delivery_days}d` : '3d'}
                          </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                            KSh {costKES.toLocaleString()}
                          </div>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                            {off.cost || off.price} {off.currency}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Commercial Margin Simulator */}
              <div className="panel" style={{ padding: '14px', background: 'var(--bg-elevated)' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <DollarSign size={13} color="var(--copper-text)" /> Commercial Resale Calculator
                </div>

                <div style={{ marginBottom: '10px' }}>
                  <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Target Retail (KES)</label>
                  <input
                    type="number"
                    value={targetSellPrice}
                    onChange={(e) => setTargetSellPrice(parseFloat(e.target.value) || 0)}
                    className="font-mono"
                    style={{ width: '100%', padding: '6px 10px', fontSize: '12px', fontWeight: 600, color: 'var(--copper-text)' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '11px' }}>
                  <div style={{ background: 'var(--bg-primary)', padding: '6px 8px', borderRadius: 'var(--radius-xs)' }}>
                    <span style={{ color: 'var(--text-muted)', display: 'block' }}>Gross Profit</span>
                    <span className="font-mono" style={{ fontWeight: 700, color: grossProfit >= 0 ? 'var(--forest-bright)' : 'var(--color-danger-text)' }}>
                      KSh {Math.round(grossProfit).toLocaleString()}
                    </span>
                  </div>

                  <div style={{ background: 'var(--bg-primary)', padding: '6px 8px', borderRadius: 'var(--radius-xs)' }}>
                    <span style={{ color: 'var(--text-muted)', display: 'block' }}>Margin %</span>
                    <span className="font-mono" style={{ fontWeight: 700, color: grossMarginPct >= 20 ? 'var(--forest-bright)' : 'var(--color-warning-text)' }}>
                      {grossMarginPct.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}
