import { useState, useEffect, useMemo } from 'react';
import { Search, ChevronDown, ChevronRight, Award, AlertTriangle, Layers, ArrowUpDown, Download, Sparkles, Eye, Scissors } from 'lucide-react';
import ProductDetailModal from './ProductDetailModal';
import * as XLSX from 'xlsx';

export default function ComparisonBoard() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('score');
  const [expanded, setExpanded] = useState({});
  const [selectedProduct, setSelectedProduct] = useState(null);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/canonical-products');
      const data = await res.json();
      setProducts(data);
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

  const filteredSorted = useMemo(() => {
    const q = search.toLowerCase().trim();
    let list = products.filter((p) => {
      if (!q) return true;
      const nameMatch = (p.canonical_name || '').toLowerCase().includes(q);
      const brandMatch = (p.brand || '').toLowerCase().includes(q);
      const skuMatch = p.offers.some((o) => (o.sku || '').toLowerCase().includes(q));
      return nameMatch || brandMatch || skuMatch;
    });

    list = [...list];
    if (sortBy === 'name') {
      list.sort((a, b) => a.canonical_name.localeCompare(b.canonical_name));
    } else if (sortBy === 'score') {
      list.sort((a, b) => (b.recommendedOffer?.scoreInfo?.totalScore || 0) - (a.recommendedOffer?.scoreInfo?.totalScore || 0));
    } else if (sortBy === 'price') {
      list.sort((a, b) => (a.recommendedOffer?.price_in_base_currency || Infinity) - (b.recommendedOffer?.price_in_base_currency || Infinity));
    } else if (sortBy === 'offers') {
      list.sort((a, b) => b.offers.length - a.offers.length);
    }

    return list;
  }, [products, search, sortBy]);

  const exportExcel = () => {
    const rows = [];
    products.forEach((p) => {
      p.offers.forEach((o) => {
        rows.push({
          'Canonical Product': p.canonical_name,
          'Brand': p.brand || 'Generic',
          'Supplier': o.supplier_name,
          'Supplier SKU': o.sku,
          'Quoted Price': o.price,
          'Currency': o.currency,
          'Base Price (KES)': o.price_in_base_currency,
          'Stock Status': o.stock_status,
          'Is Recommended Supplier': p.recommendedOffer?.raw_listing_id === o.raw_listing_id ? 'YES' : 'NO',
          'Sourcing Score': o.scoreInfo?.totalScore || ''
        });
      });
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Procurement Comparison');
    XLSX.writeFile(wb, `Procurement_Sourcing_Board_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  if (loading) {
    return <div style={{ color: '#949eb2', padding: '24px', textAlign: 'center' }}>Loading Sourcing Comparison Board...</div>;
  }

  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto', color: '#f0f3f8' }}>
      
      {/* Top Action Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={22} color="#2dd4bf" /> Procurement Comparison Board
          </h2>
          <p style={{ fontSize: '13px', color: '#949eb2', marginTop: '4px' }}>
            Canonical product catalogue with weighted sourcing supplier recommendations & multi-currency normalization.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={exportExcel}
            style={{ background: '#202430', border: '1px solid #2b303d', color: '#f0f3f8', padding: '8px 14px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Download size={15} /> Export Excel
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
          <Search size={16} color="#949eb2" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search canonical product name, brand, or SKU..."
            style={{ background: '#181b24', border: '1px solid #2b303d', borderRadius: '8px', color: '#f0f3f8', padding: '8px 12px 8px 36px', fontSize: '13px', width: '100%', outline: 'none' }}
          />
        </div>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          style={{ background: '#181b24', border: '1px solid #2b303d', borderRadius: '8px', color: '#f0f3f8', padding: '8px 12px', fontSize: '13px', outline: 'none' }}
        >
          <option value="score">Sort by: Recommended Score</option>
          <option value="name">Sort by: Product Name (A-Z)</option>
          <option value="price">Sort by: Lowest Price (KES)</option>
          <option value="offers">Sort by: Most Supplier Offers</option>
        </select>
      </div>

      {/* Comparison Grid */}
      <div style={{ background: '#181b24', border: '1px solid #2b303d', borderRadius: '14px', overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '30px 2.2fr 1.6fr 1.4fr 1fr 40px', gap: '12px', padding: '12px 16px', fontSize: '11px', color: '#949eb2', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #2b303d', background: '#202430' }}>
          <div></div><div>Canonical Product</div><div>Recommended Supplier</div><div>Base Price (KES)</div><div>Offers</div><div>Detail</div>
        </div>

        {filteredSorted.length === 0 ? (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: '#949eb2', fontSize: '13px' }}>
            No canonical products match your search.
          </div>
        ) : (
          filteredSorted.map((p) => {
            const isOpen = !!expanded[p.id];
            const rec = p.recommendedOffer;

            return (
              <div key={p.id}>
                <div
                  onClick={() => toggleExpand(p.id)}
                  style={{ display: 'grid', gridTemplateColumns: '30px 2.2fr 1.6fr 1.4fr 1fr 40px', gap: '12px', padding: '14px 16px', borderBottom: '1px solid #2b303d', cursor: 'pointer', alignItems: 'center', background: isOpen ? '#13161f' : 'transparent', transition: 'background 0.15s ease' }}
                >
                  <div style={{ color: '#949eb2' }}>
                    {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </div>

                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 600 }}>{p.canonical_name}</div>
                    <div style={{ fontSize: '11px', color: '#949eb2', marginTop: '2px' }}>
                      Brand: {p.brand || 'Generic'} · Category: {p.category || 'Electronics'}
                    </div>
                  </div>

                  <div>
                    {rec ? (
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', fontWeight: 600, color: '#2dd4bf' }}>
                          <Award size={14} /> {rec.supplier_name}
                        </div>
                        <div style={{ fontSize: '11px', color: '#949eb2', marginTop: '1px' }}>
                          Score: <strong style={{ color: '#2dd4bf' }}>{rec.scoreInfo?.totalScore || 'N/A'}</strong> · {rec.supplier.avg_delivery_days}d Lead Time
                        </div>
                      </div>
                    ) : (
                      <span style={{ fontSize: '12px', color: '#949eb2' }}>—</span>
                    )}
                  </div>

                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '14px', fontWeight: 600, color: '#2dd4bf' }}>
                    {rec ? `${rec.price_in_base_currency.toLocaleString(undefined, { minimumFractionDigits: 2 })} KES` : '—'}
                  </div>

                  <div>
                    <span style={{ background: '#202430', border: '1px solid #2b303d', color: '#f0f3f8', padding: '2px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: 600 }}>
                      {p.offers.length} Quotes
                    </span>
                  </div>

                  <div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedProduct(p); }}
                      style={{ background: 'none', border: 'none', color: '#949eb2', cursor: 'pointer' }}
                      title="Inspect Product Detail"
                    >
                      <Eye size={16} />
                    </button>
                  </div>
                </div>

                {/* Expanded Supplier Offers Sub-Row */}
                {isOpen && (
                  <div style={{ background: '#0f1117', borderBottom: '1px solid #2b303d', padding: '8px 16px 8px 42px' }}>
                    {p.offers.map((off) => {
                      const isRec = rec && rec.raw_listing_id === off.raw_listing_id;
                      return (
                        <div key={off.id} style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr 1fr 1fr', gap: '10px', padding: '8px 0', alignItems: 'center', fontSize: '12px', borderTop: '1px solid #181b24' }}>
                          <div>
                            <span style={{ fontWeight: isRec ? 700 : 500, color: isRec ? '#2dd4bf' : '#f0f3f8' }}>{off.supplier_name}</span>
                            <span style={{ color: '#949eb2', marginLeft: '8px', fontSize: '11px' }}>({off.raw_name})</span>
                          </div>
                          <div style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{off.price} {off.currency}</div>
                          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: isRec ? 700 : 400, color: isRec ? '#2dd4bf' : '#f0f3f8' }}>
                            {off.price_in_base_currency.toLocaleString(undefined, { minimumFractionDigits: 2 })} KES
                          </div>
                          <div>
                            <span style={{ color: off.stock_status === 'in_stock' ? '#3ddc97' : '#f43f5e' }}>
                              ● {off.stock_status === 'in_stock' ? 'In Stock' : 'Out of Stock'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Product Detail Modal */}
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
