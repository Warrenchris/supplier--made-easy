import { useState, useEffect } from 'react';
import { 
  ShoppingCart, DollarSign, Percent, Hash, RefreshCw, 
  Eye, EyeOff, Settings, CheckCircle2, ShieldCheck, 
  ArrowRight, Layers, Tag
} from 'lucide-react';

const STRATEGIES = [
  { key: 'markup', label: 'Markup', formula: 'Cost × (1 + rate)', icon: Percent },
  { key: 'gross_margin', label: 'Gross Margin', formula: 'Cost / (1 - rate)', icon: DollarSign },
  { key: 'fixed_price', label: 'Fixed Price', formula: 'Fixed retail price', icon: Hash },
  { key: 'cost_plus_fixed', label: 'Cost + Fixed', formula: 'Cost + fixed amount', icon: DollarSign }
];

export default function StorefrontSync() {
  const [economics, setEconomics] = useState([]);
  const [publicFeed, setPublicFeed] = useState([]);
  const [settings, setSettings] = useState({ defaultPricingStrategy: 'markup', defaultMarginRate: 0.30 });
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('admin'); // 'admin' or 'public'
  const [savedMsg, setSavedMsg] = useState('');

  useEffect(() => { 
    fetchData(); 
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [ecoRes, pubRes, settingsRes] = await Promise.all([
        fetch('/api/internal/storefront-economics').then((r) => r.json()),
        fetch('/api/storefront/products').then((r) => r.json()),
        fetch('/api/admin/settings').then((r) => r.json())
      ]);
      setEconomics(Array.isArray(ecoRes) ? ecoRes : []);
      setPublicFeed(Array.isArray(pubRes) ? pubRes : []);
      if (settingsRes.storefrontSettings) setSettings(settingsRes.storefrontSettings);
    } catch (err) {
      console.error('Failed to load storefront sync telemetry:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async (updates) => {
    const newSettings = { ...settings, ...updates };
    setSettings(newSettings);
    try {
      await fetch('/api/storefront/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings)
      });
      setSavedMsg('Storefront pricing policy updated.');
      setTimeout(() => setSavedMsg(''), 3000);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  // Compute stats
  const avgMargin = economics.length > 0 
    ? (economics.reduce((sum, e) => sum + (e.grossMargin || 0), 0) / economics.length).toFixed(1)
    : '0.0';

  if (loading) {
    return (
      <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
        <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite', marginBottom: '8px' }} />
        <div>Loading Storefront Commercial Sync...</div>
      </div>
    );
  }

  return (
    <div className="animate-fade" style={{ maxWidth: '1280px', margin: '0 auto' }}>
      
      {/* ─── Header ─── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--forest-text)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
            Omnichannel Commerce
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Realmer Storefront & Retail Pricing Engine
          </h1>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Automate retail pricing policies, maintain target gross margins, and syndicate feeds to your ecommerce storefront.
          </p>
        </div>

        {/* View Switcher */}
        <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', padding: '3px', borderRadius: 'var(--radius-sm)' }}>
          <button
            type="button"
            onClick={() => setViewMode('admin')}
            style={{
              padding: '5px 12px',
              fontSize: '11px',
              borderRadius: 'var(--radius-xs)',
              backgroundColor: viewMode === 'admin' ? 'var(--bg-elevated)' : 'transparent',
              color: viewMode === 'admin' ? 'var(--copper-text)' : 'var(--text-muted)',
              border: `1px solid ${viewMode === 'admin' ? 'var(--copper-border)' : 'transparent'}`
            }}
          >
            <Eye size={12} /> Admin Economics
          </button>

          <button
            type="button"
            onClick={() => setViewMode('public')}
            style={{
              padding: '5px 12px',
              fontSize: '11px',
              borderRadius: 'var(--radius-xs)',
              backgroundColor: viewMode === 'public' ? 'var(--bg-elevated)' : 'transparent',
              color: viewMode === 'public' ? 'var(--forest-bright)' : 'var(--text-muted)',
              border: `1px solid ${viewMode === 'public' ? 'var(--forest-border)' : 'transparent'}`
            }}
          >
            <ShieldCheck size={12} /> Public Feed (Scrubbed)
          </button>
        </div>
      </div>

      {savedMsg && (
        <div className="panel" style={{ padding: '10px 16px', marginBottom: '16px', background: 'var(--color-success-bg)', color: 'var(--color-success-text)', fontSize: '12px' }}>
          ✓ {savedMsg}
        </div>
      )}

      {/* ─── Storefront Summary KPI Strip ─── */}
      <div 
        className="panel" 
        style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          marginBottom: '20px', 
          overflow: 'hidden' 
        }}
      >
        <div style={{ padding: '16px 20px', borderRight: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Sync Status</div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--forest-bright)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            ● Connected & Live
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Base Currency: KES</div>
        </div>

        <div style={{ padding: '16px 20px', borderRight: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Active Catalog Feed</div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
            {publicFeed.length} Products
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Ready for syndication</div>
        </div>

        <div style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: '10px', color: 'var(--copper-text)', textTransform: 'uppercase', fontWeight: 600 }}>Catalog Average Gross Margin</div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--copper-text)', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
            {avgMargin}%
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Calculated from best acquisition cost</div>
        </div>
      </div>

      {/* ─── Global Pricing Strategy Configuration ─── */}
      <div className="panel" style={{ padding: '18px 20px', marginBottom: '20px' }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
          <Settings size={14} color="var(--forest-bright)" /> Default Pricing Strategy Rule
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px', marginBottom: '16px' }}>
          {STRATEGIES.map((s) => {
            const active = settings.defaultPricingStrategy === s.key;
            const Icon = s.icon;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => updateSettings({ defaultPricingStrategy: s.key })}
                style={{
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: active ? 'var(--bg-elevated)' : 'var(--bg-surface)',
                  border: `1px solid ${active ? 'var(--forest-border)' : 'var(--border-subtle)'}`,
                  textAlign: 'left',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: active ? 'var(--forest-bright)' : 'var(--text-secondary)' }}>
                  <Icon size={14} />
                  <span style={{ fontSize: '12px', fontWeight: 600 }}>{s.label}</span>
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {s.formula}
                </div>
              </button>
            );
          })}
        </div>

        {(settings.defaultPricingStrategy === 'markup' || settings.defaultPricingStrategy === 'gross_margin') && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'var(--bg-primary)', padding: '10px 16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Target Rate:</span>
            <input
              type="range"
              min="5"
              max="80"
              step="1"
              value={Math.round((settings.defaultMarginRate || 0.30) * 100)}
              onChange={(e) => updateSettings({ defaultMarginRate: parseInt(e.target.value) / 100 })}
              style={{ flex: 1, accentColor: 'var(--forest-primary)', cursor: 'pointer' }}
            />
            <span style={{ fontSize: '14px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--forest-bright)', minWidth: '46px' }}>
              {Math.round((settings.defaultMarginRate || 0.30) * 100)}%
            </span>
          </div>
        )}
      </div>

      {/* ─── Data Tables ─── */}
      <div className="panel" style={{ overflow: 'hidden' }}>
        {viewMode === 'admin' ? (
          /* Admin Economics View */
          <table className="enterprise-table">
            <thead>
              <tr>
                <th>Product Name</th>
                <th>Brand</th>
                <th style={{ textAlign: 'right' }}>Acquisition (KES)</th>
                <th style={{ textAlign: 'right' }}>Retail Price</th>
                <th style={{ textAlign: 'right' }}>Gross Margin</th>
                <th style={{ textAlign: 'right' }}>Profit / Unit</th>
                <th style={{ textAlign: 'center' }}>Total Stock</th>
                <th style={{ textAlign: 'left' }}>Sourcing Vendor</th>
              </tr>
            </thead>
            <tbody>
              {economics.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)' }}>
                    No products available for economics calculation.
                  </td>
                </tr>
              ) : (
                economics.map((item) => (
                  <tr key={item.productId}>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.name}</td>
                    <td><span className="badge badge-neutral">{item.brand || 'Generic'}</span></td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                      KSh {item.acquisitionCost.toLocaleString()}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--copper-text)' }}>
                      KSh {item.retailPrice.toLocaleString()}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--forest-bright)', fontWeight: 600 }}>
                      {item.grossMargin}%
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                      KSh {item.profitPerUnit.toLocaleString()}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`badge ${item.totalStock > 0 ? 'badge-success' : 'badge-danger'}`}>
                        {item.totalStock} units
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{item.bestSupplier}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        ) : (
          /* Public Sanitized Realmer Feed */
          <table className="enterprise-table">
            <thead>
              <tr>
                <th>Product ID</th>
                <th>Public Title</th>
                <th>Brand</th>
                <th>Category</th>
                <th style={{ textAlign: 'right' }}>Retail Price (KES)</th>
                <th style={{ textAlign: 'center' }}>Availability</th>
                <th style={{ textAlign: 'center' }}>Available Qty</th>
              </tr>
            </thead>
            <tbody>
              {publicFeed.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)' }}>
                    No public catalog products ready for syndication.
                  </td>
                </tr>
              ) : (
                publicFeed.map((item) => (
                  <tr key={item.productId}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>
                      {item.productId}
                    </td>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.name}</td>
                    <td>{item.brand}</td>
                    <td><span className="badge badge-neutral">{item.category}</span></td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                      KSh {item.price.toLocaleString()}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`badge ${item.availability === 'in_stock' ? 'badge-success' : 'badge-danger'}`}>
                        {item.availability === 'in_stock' ? 'In Stock' : 'Out of Stock'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
                      {item.quantity}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

    </div>
  );
}
