import { useState, useEffect } from 'react';
import { 
  Package, Store, DollarSign, GitMerge, TrendingDown, 
  TrendingUp, ArrowRight, ShieldCheck, AlertCircle, 
  Target, Layers, Zap, CheckCircle2, ChevronRight, Upload,
  AlertTriangle, ArrowUpRight, Sparkles
} from 'lucide-react';

export default function OverviewDashboard({ onNavigate, onOpenImport }) {
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [matchSuggestions, setMatchSuggestions] = useState([]);
  const [trends, setTrends] = useState({});
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

        const prods = Array.isArray(prodRes) ? prodRes : [];
        setProducts(prods);
        setSuppliers(Array.isArray(supRes) ? supRes : []);
        setMatchSuggestions(Array.isArray(matchRes) ? matchRes : []);

        // Fetch price trend counts
        let priceDropCount = 0;
        let priceIncreaseCount = 0;
        for (const p of prods.slice(0, 15)) {
          try {
            const tRes = await fetch(`/api/price-trends?productId=${p.id}`);
            const tData = await tRes.json();
            const primary = Array.isArray(tData) ? tData[0] : tData;
            if (primary?.trend30d?.direction === 'down' || primary?.trend7d?.direction === 'down') priceDropCount++;
            if (primary?.trend30d?.direction === 'up' || primary?.trend7d?.direction === 'up') priceIncreaseCount++;
          } catch {}
        }
        setTrends({ drops: priceDropCount, increases: priceIncreaseCount });
      } catch (err) {
        console.error('Failed to load overview telemetry:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchOverviewData();
  }, []);

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
          highestOffer: highest,
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
      <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
        <div style={{ fontSize: '13px' }}>Loading Procurement Operations Cockpit...</div>
      </div>
    );
  }

  return (
    <div className="animate-fade" style={{ maxWidth: '1280px', margin: '0 auto' }}>
      
      {/* ─── Operational Header ─── */}
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--forest-text)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>
            Executive Sourcing Cockpit
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
            Good morning, Procurement Overview
          </h1>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
            {formattedDate} · Base Currency: KES
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={onOpenImport} className="btn-secondary" style={{ fontSize: '12px' }}>
            <Upload size={13} /> Import Price List
          </button>
          <button onClick={() => onNavigate('optimizer')} className="btn-primary" style={{ fontSize: '12px' }}>
            <Target size={13} /> Optimize Sourcing
          </button>
        </div>
      </div>

      {/* ─── 4-Question Executive KPI Strip ─── */}
      <div 
        className="panel"
        style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', 
          marginBottom: '24px',
          overflow: 'hidden'
        }}
      >
        {/* Question 1: What can I save? */}
        <div style={{ padding: '18px 20px', borderRight: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '10px', color: 'var(--copper-text)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>
              1. Potential Sourcing Savings
            </span>
            <span className="badge badge-recommendation" style={{ fontSize: '9px', padding: '1px 5px' }}>
              Actionable
            </span>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--copper-text)', marginTop: '6px', fontFamily: 'var(--font-mono)' }}>
            KSh {Math.round(totalPotentialSavings).toLocaleString()}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Identified across {opportunities.length} multi-supplier products
          </div>
        </div>

        {/* Question 2: What needs my attention? */}
        <div style={{ padding: '18px 20px', borderRight: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>
              2. Requires Human Review
            </span>
            <span className={`badge ${matchSuggestions.length > 0 ? 'badge-warning' : 'badge-success'}`} style={{ fontSize: '9px', padding: '1px 5px' }}>
              {matchSuggestions.length > 0 ? 'Action Needed' : 'Clean'}
            </span>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: matchSuggestions.length > 0 ? 'var(--color-warning-text)' : 'var(--text-primary)', marginTop: '6px', fontFamily: 'var(--font-mono)' }}>
            {matchSuggestions.length} Listings
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            {matchSuggestions.length > 0 ? (
              <span onClick={() => onNavigate('queue')} style={{ color: 'var(--copper-text)', cursor: 'pointer', fontWeight: 600 }}>
                Review mapping queue →
              </span>
            ) : (
              'All supplier listings verified'
            )}
          </div>
        </div>

        {/* Question 3: Where are prices moving? */}
        <div style={{ padding: '18px 20px', borderRight: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>
              3. Price Movements (30D)
            </span>
            <span className="badge badge-insight" style={{ fontSize: '9px', padding: '1px 5px' }}>
              Telemetry
            </span>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '6px', fontFamily: 'var(--font-mono)' }}>
            {trends.drops || 0} Drops <span style={{ fontSize: '16px', color: 'var(--forest-bright)' }}>↓</span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            {trends.increases || 0} price increases detected
          </div>
        </div>

        {/* Question 4: What should I buy differently? */}
        <div style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>
              4. Sourcing Opportunities
            </span>
            <span className="badge badge-forest" style={{ fontSize: '9px', padding: '1px 5px' }}>
              Optimal
            </span>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--forest-bright)', marginTop: '6px', fontFamily: 'var(--font-mono)' }}>
            {opportunities.length} Items
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Ready for multi-vendor optimization
          </div>
        </div>
      </div>

      {/* ─── Main Operations Split: Opportunities Feed + Action Center ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', marginBottom: '24px' }}>
        
        {/* Left: Sourcing Opportunities (Visual Centerpiece) */}
        <div className="panel">
          <div className="panel-header">
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Target size={15} color="var(--forest-bright)" /> Priority Sourcing Opportunities
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Products with the largest price spread between suppliers. Buying from the recommended vendor yields direct savings.
              </div>
            </div>
            <button onClick={() => onNavigate('products')} className="btn-ghost" style={{ fontSize: '11px' }}>
              View All ({products.length}) <ChevronRight size={13} />
            </button>
          </div>

          {opportunities.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Package size={28} style={{ opacity: 0.4, marginBottom: '8px' }} />
              <div style={{ fontSize: '13px', fontWeight: 600 }}>No Multi-Supplier Catalog Items Yet</div>
              <div style={{ fontSize: '11px', marginTop: '4px', maxWidth: '360px', margin: '4px auto 0' }}>
                Import pricelists from multiple suppliers to enable automated price comparison, spread detection, and procurement optimization.
              </div>
              <button onClick={onOpenImport} className="btn-primary" style={{ marginTop: '16px', fontSize: '12px' }}>
                <Upload size={13} /> Import Supplier Pricelist
              </button>
            </div>
          ) : (
            <div style={{ padding: '6px 0' }}>
              {opportunities.slice(0, 5).map((op) => {
                const prod = op.product;
                const best = op.bestOffer;
                const high = op.highestOffer;
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
                      
                      {/* Data -> Insight -> Recommendation hierarchy */}
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', gap: '12px', alignItems: 'center', marginTop: '3px' }}>
                        <span>
                          <strong style={{ color: 'var(--forest-bright)' }}>{best.supplier_name}</strong>: KSh {Math.round(best.cost_in_base_currency || best.price_in_base_currency || 0).toLocaleString()}
                        </span>
                        <span>·</span>
                        <span>
                          {high.supplier_name}: KSh {Math.round(high.cost_in_base_currency || high.price_in_base_currency || 0).toLocaleString()}
                        </span>
                        <span>·</span>
                        <span style={{ color: 'var(--text-secondary)' }}>{op.totalStock} in stock</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', textAlign: 'right' }}>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--copper-text)', fontFamily: 'var(--font-mono)' }}>
                          Save KSh {Math.round(op.savingPerUnit).toLocaleString()}
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: '3px' }}>/unit</span>
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                          ~KSh {Math.round(op.batchSaving).toLocaleString()} on batch
                        </div>
                      </div>

                      <button 
                        onClick={() => onNavigate('optimizer', prod)}
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <GitMerge size={14} color="var(--copper-text)" /> Entity Resolution
              </div>
              <span className={`badge ${matchSuggestions.length > 0 ? 'badge-warning' : 'badge-success'}`}>
                {matchSuggestions.length} Pending
              </span>
            </div>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.4, marginBottom: '12px' }}>
              {matchSuggestions.length > 0
                ? `${matchSuggestions.length} supplier listings require human verification before mapping to canonical inventory.`
                : 'All supplier catalog rows verified against canonical product master records.'}
            </p>
            <button 
              onClick={() => onNavigate('queue')}
              className="btn-secondary" 
              style={{ width: '100%', fontSize: '11px' }}
            >
              Open Reconciliation Queue
            </button>
          </div>

          {/* Quick Commerce Sync Status */}
          <div className="panel" style={{ padding: '16px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Zap size={14} color="var(--forest-bright)" /> Storefront Operations
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ color: 'var(--text-muted)' }}>Pricing Policy</span>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Target 30% Markup</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ color: 'var(--text-muted)' }}>Realmer Syndication</span>
                <span style={{ color: 'var(--forest-bright)', fontWeight: 600 }}>● Active Feed</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                <span style={{ color: 'var(--text-muted)' }}>Active Vendors</span>
                <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{suppliers.length} Vendors</span>
              </div>
            </div>

            <button 
              onClick={() => onNavigate('storefront')}
              className="btn-ghost" 
              style={{ width: '100%', marginTop: '10px', fontSize: '11px' }}
            >
              Manage Storefront Economics
            </button>
          </div>

        </div>

      </div>

    </div>
  );
}
