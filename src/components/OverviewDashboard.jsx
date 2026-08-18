import { useState, useEffect } from 'react';
import { 
  Package, Store, DollarSign, GitMerge, TrendingDown, 
  TrendingUp, ArrowRight, ShieldCheck, AlertCircle, 
  Target, Layers, Zap, CheckCircle2, ChevronRight, Upload
} from 'lucide-react';

export default function OverviewDashboard({ onNavigate, onOpenImport }) {
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [matchSuggestions, setMatchSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOverviewData = async () => {
      setLoading(true);
      try {
        const [prodRes, supRes, matchRes] = await Promise.all([
          fetch('/api/canonical-products').then((r) => r.json()),
          fetch('/api/suppliers').then((r) => r.json()),
          fetch('/api/match-suggestions').then((r) => r.json())
        ]);

        setProducts(Array.isArray(prodRes) ? prodRes : []);
        setSuppliers(Array.isArray(supRes) ? supRes : []);
        setMatchSuggestions(Array.isArray(matchRes) ? matchRes : []);
      } catch (err) {
        console.error('Failed to load overview telemetry:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchOverviewData();
  }, []);

  // Compute operational telemetry
  const totalOffers = products.reduce((sum, p) => sum + (p.offers?.length || 0), 0);
  
  // Calculate potential procurement savings across all multi-supplier products
  let totalPotentialSavings = 0;
  const opportunities = [];

  products.forEach((p) => {
    const offers = p.offers || [];
    if (offers.length >= 2) {
      const sorted = [...offers].sort((a, b) => (a.cost_in_base_currency || a.price_in_base_currency) - (b.cost_in_base_currency || b.price_in_base_currency));
      const lowest = sorted[0];
      const highest = sorted[sorted.length - 1];
      const lowestPrice = lowest.cost_in_base_currency || lowest.price_in_base_currency || 0;
      const highestPrice = highest.cost_in_base_currency || highest.price_in_base_currency || 0;
      const savingPerUnit = highestPrice - lowestPrice;
      
      if (savingPerUnit > 0) {
        const totalStockAvail = offers.reduce((acc, o) => acc + (o.quantity_available || o.stock_qty || 0), 0);
        const batchSaving = savingPerUnit * Math.min(20, totalStockAvail || 20);
        totalPotentialSavings += batchSaving;

        opportunities.push({
          product: p,
          bestOffer: lowest,
          savingPerUnit,
          batchSaving,
          supplierCount: offers.length,
          totalStock: totalStockAvail
        });
      }
    }
  });

  opportunities.sort((a, b) => b.savingPerUnit - a.savingPerUnit);

  const formattedDate = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(new Date());

  if (loading) {
    return (
      <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
        <div style={{ fontSize: '13px' }}>Loading Procurement Workspace...</div>
      </div>
    );
  }

  return (
    <div className="animate-fade" style={{ maxWidth: '1280px', margin: '0 auto' }}>
      
      {/* ─── Operational Header ─── */}
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--forest-text)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
            Operations Cockpit
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
            Good morning, Procurement Overview
          </h1>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
            {formattedDate} · Base Currency: KES
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={onOpenImport} className="btn-secondary" style={{ fontSize: '12px' }}>
            <Upload size={14} /> Import Price List
          </button>
          <button onClick={() => onNavigate('optimizer')} className="btn-primary" style={{ fontSize: '12px' }}>
            <Target size={14} /> Launch Optimizer
          </button>
        </div>
      </div>

      {/* ─── Structured KPI Metric Strip ─── */}
      <div 
        className="panel"
        style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          marginBottom: '24px',
          overflow: 'hidden'
        }}
      >
        <div style={{ padding: '16px 20px', borderRight: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.04em' }}>
            Active Products
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '6px', fontFamily: 'var(--font-mono)' }}>
            {products.length.toLocaleString()}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--forest-bright)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <CheckCircle2 size={12} /> Live canonical catalog
          </div>
        </div>

        <div style={{ padding: '16px 20px', borderRight: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.04em' }}>
            Supplier Offers
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '6px', fontFamily: 'var(--font-mono)' }}>
            {totalOffers.toLocaleString()}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Across {suppliers.length} active suppliers
          </div>
        </div>

        <div style={{ padding: '16px 20px', borderRight: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: '11px', color: 'var(--copper-text)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.04em' }}>
            Identified Arbitrage Potential
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--copper-text)', marginTop: '6px', fontFamily: 'var(--font-mono)' }}>
            KSh {Math.round(totalPotentialSavings).toLocaleString()}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Across multi-supplier items
          </div>
        </div>

        <div style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.04em' }}>
            Pending Match Reviews
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: matchSuggestions.length > 0 ? 'var(--color-warning-text)' : 'var(--text-primary)', marginTop: '6px', fontFamily: 'var(--font-mono)' }}>
            {matchSuggestions.length}
          </div>
          <div style={{ fontSize: '11px', color: matchSuggestions.length > 0 ? 'var(--color-warning-text)' : 'var(--forest-bright)', marginTop: '4px' }}>
            {matchSuggestions.length > 0 ? 'Requires human verification' : 'Queue fully reconciled'}
          </div>
        </div>
      </div>

      {/* ─── Main Operations Split Grid ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', marginBottom: '24px' }}>
        
        {/* Left: Procurement Opportunities */}
        <div className="panel">
          <div className="panel-header">
            <div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Target size={16} color="var(--forest-bright)" /> Top Procurement Opportunities
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Highest spread items where optimal supplier selection yields immediate savings.
              </div>
            </div>
            <button onClick={() => onNavigate('products')} className="btn-ghost" style={{ fontSize: '12px' }}>
              View All <ChevronRight size={14} />
            </button>
          </div>

          {opportunities.length === 0 ? (
            <div style={{ padding: '36px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Package size={28} style={{ opacity: 0.5, marginBottom: '8px' }} />
              <div style={{ fontSize: '13px', fontWeight: 600 }}>No Multi-Supplier Catalog Items Yet</div>
              <div style={{ fontSize: '12px', marginTop: '4px', maxWidth: '360px', margin: '4px auto 0' }}>
                Import pricelists from multiple suppliers to enable automated price comparison, spread detection, and procurement optimization.
              </div>
              <button onClick={onOpenImport} className="btn-primary" style={{ marginTop: '16px', fontSize: '12px' }}>
                <Upload size={14} /> Import Supplier Pricelist
              </button>
            </div>
          ) : (
            <div style={{ padding: '8px 0' }}>
              {opportunities.slice(0, 5).map((op) => {
                const prod = op.product;
                const best = op.bestOffer;
                return (
                  <div 
                    key={prod.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 18px',
                      borderBottom: '1px solid var(--border-subtle)',
                      transition: 'background-color 0.15s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-elevated)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <div style={{ flex: 1, minWidth: 0, paddingRight: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                        <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {prod.canonical_name}
                        </span>
                        <span className="badge badge-neutral">{prod.brand || 'Generic'}</span>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        Best Supplier: <strong style={{ color: 'var(--text-secondary)' }}>{best.supplier_name}</strong> · {op.supplierCount} competing offers · {op.totalStock} units in stock
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px', textAlign: 'right' }}>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--forest-bright)', fontFamily: 'var(--font-mono)' }}>
                          KSh {Math.round(best.cost_in_base_currency || best.price_in_base_currency || 0).toLocaleString()}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--copper-text)', fontFamily: 'var(--font-mono)' }}>
                          Saves ~KSh {Math.round(op.savingPerUnit).toLocaleString()}/unit
                        </div>
                      </div>

                      <button 
                        onClick={() => onNavigate('optimizer')}
                        className="btn-secondary"
                        style={{ padding: '5px 10px', fontSize: '11px' }}
                      >
                        Optimize <ArrowRight size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Operational Status & Fast Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Action Required: Review Queue */}
          <div className="panel" style={{ padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <GitMerge size={15} color="var(--copper-text)" /> Match Reconciliation
              </div>
              <span className={`badge ${matchSuggestions.length > 0 ? 'badge-warning' : 'badge-success'}`}>
                {matchSuggestions.length} Pending
              </span>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.4, marginBottom: '12px' }}>
              {matchSuggestions.length > 0
                ? `${matchSuggestions.length} supplier listings require human verification before matching canonical inventory.`
                : 'All incoming supplier records have been validated against the canonical catalog.'}
            </p>
            <button 
              onClick={() => onNavigate('queue')}
              className="btn-secondary" 
              style={{ width: '100%', fontSize: '12px' }}
            >
              Open Reconciliation Queue
            </button>
          </div>

          {/* Quick Intelligence Summary */}
          <div className="panel" style={{ padding: '16px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Zap size={15} color="var(--forest-bright)" /> System Intelligence
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ color: 'var(--text-muted)' }}>Scoring Framework</span>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>6-Metric Radar</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ color: 'var(--text-muted)' }}>Storefront Sync</span>
                <span style={{ color: 'var(--forest-bright)', fontWeight: 500 }}>● Active (KES)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                <span style={{ color: 'var(--text-muted)' }}>Catalog Coverage</span>
                <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{products.length} Products</span>
              </div>
            </div>

            <button 
              onClick={() => onNavigate('settings')}
              className="btn-ghost" 
              style={{ width: '100%', marginTop: '12px', fontSize: '11px' }}
            >
              Configure Parameters
            </button>
          </div>

        </div>

      </div>

    </div>
  );
}
