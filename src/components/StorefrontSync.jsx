import { useState, useEffect } from 'react';
import { ShoppingCart, DollarSign, Percent, Hash, RefreshCw, Eye, EyeOff, Settings } from 'lucide-react';

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

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [ecoRes, pubRes, settingsRes] = await Promise.all([
        fetch('/api/internal/storefront-economics'),
        fetch('/api/storefront/products'),
        fetch('/api/admin/settings')
      ]);
      setEconomics(await ecoRes.json());
      setPublicFeed(await pubRes.json());
      const adminData = await settingsRes.json();
      if (adminData.storefrontSettings) setSettings(adminData.storefrontSettings);
    } catch {}
    setLoading(false);
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
      fetchData();
    } catch {}
  };

  const cardStyle = {
    background: '#181b24', border: '1px solid #2b303d', borderRadius: '12px', padding: '20px'
  };
  const labelStyle = { color: '#949eb2', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' };

  if (loading) {
    return (
      <div style={{ color: '#949eb2', textAlign: 'center', padding: '60px 0' }}>
        <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite' }} />
        <div style={{ marginTop: '12px' }}>Loading storefront data…</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h2 style={{ color: '#f0f3f8', fontSize: '22px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
            <ShoppingCart size={22} style={{ color: '#f59e0b' }} /> Realmer Storefront Sync
          </h2>
          <p style={{ color: '#949eb2', fontSize: '13px', marginTop: '6px' }}>
            Manage retail pricing strategies and view the public storefront product feed.
          </p>
        </div>

        {/* View Toggle */}
        <div style={{ display: 'flex', gap: '4px', background: '#0f1117', border: '1px solid #2b303d', padding: '4px', borderRadius: '8px' }}>
          {[['admin', 'Economics', Eye], ['public', 'Public Feed', EyeOff]].map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => setViewMode(key)}
              style={{
                padding: '6px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 600,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
                background: viewMode === key ? '#202430' : 'transparent',
                border: `1px solid ${viewMode === key ? '#f59e0b' : 'transparent'}`,
                color: viewMode === key ? '#f59e0b' : '#949eb2'
              }}
            >
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>
      </div>

      {/* Pricing Strategy Settings */}
      <div style={{ ...cardStyle, marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
          <Settings size={15} style={{ color: '#f59e0b' }} />
          <span style={{ color: '#f0f3f8', fontWeight: 600, fontSize: '14px' }}>Default Pricing Strategy</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '16px' }}>
          {STRATEGIES.map((s) => {
            const active = settings.defaultPricingStrategy === s.key;
            const Icon = s.icon;
            return (
              <button
                key={s.key}
                onClick={() => updateSettings({ defaultPricingStrategy: s.key })}
                style={{
                  padding: '12px', borderRadius: '10px', cursor: 'pointer', textAlign: 'left',
                  background: active ? '#202430' : '#0f1117',
                  border: `1px solid ${active ? '#f59e0b' : '#2b303d'}`,
                  color: active ? '#f0f3f8' : '#949eb2'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <Icon size={14} style={{ color: active ? '#f59e0b' : '#949eb2' }} />
                  <span style={{ fontSize: '13px', fontWeight: 600 }}>{s.label}</span>
                </div>
                <div style={{ fontSize: '10px', fontFamily: "'IBM Plex Mono', monospace", color: '#949eb2' }}>{s.formula}</div>
              </button>
            );
          })}
        </div>

        {(settings.defaultPricingStrategy === 'markup' || settings.defaultPricingStrategy === 'gross_margin') && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={labelStyle}>Rate</div>
            <input
              type="range" min="5" max="80" step="1"
              value={Math.round((settings.defaultMarginRate || 0.30) * 100)}
              onChange={(e) => updateSettings({ defaultMarginRate: parseInt(e.target.value) / 100 })}
              style={{ flex: 1 }}
            />
            <span style={{ color: '#f59e0b', fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace", minWidth: '42px' }}>
              {Math.round((settings.defaultMarginRate || 0.30) * 100)}%
            </span>
          </div>
        )}

        {/* Example Calculation */}
        <div style={{ marginTop: '12px', padding: '10px 14px', borderRadius: '8px', background: '#0f1117', border: '1px solid #1a1d27' }}>
          <span style={{ color: '#949eb2', fontSize: '11px' }}>Example: </span>
          <span style={{ color: '#f0f3f8', fontSize: '12px', fontFamily: "'IBM Plex Mono', monospace" }}>
            {settings.defaultPricingStrategy === 'markup' && `Cost KSh 10,000 → Retail KSh ${Math.round(10000 * (1 + (settings.defaultMarginRate || 0.30))).toLocaleString()}`}
            {settings.defaultPricingStrategy === 'gross_margin' && `Cost KSh 10,000 → Retail KSh ${Math.round(10000 / (1 - (settings.defaultMarginRate || 0.30))).toLocaleString()}`}
            {settings.defaultPricingStrategy === 'fixed_price' && `Retail = Fixed price (set per product)`}
            {settings.defaultPricingStrategy === 'cost_plus_fixed' && `Cost KSh 10,000 + Fixed amount → Retail`}
          </span>
        </div>
      </div>

      {/* Product Feed Table */}
      <div style={cardStyle}>
        <div style={{ ...labelStyle, marginBottom: '14px' }}>
          {viewMode === 'admin' ? 'Internal Economics Feed' : 'Public Storefront Feed (Realmer)'}
          {viewMode === 'public' && (
            <span style={{ marginLeft: '8px', padding: '2px 8px', borderRadius: '4px', background: '#ef444420', color: '#ef4444', fontSize: '10px', fontWeight: 700 }}>
              No acquisition data exposed
            </span>
          )}
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #2b303d' }}>
              {viewMode === 'admin' ? (
                <>
                  {['Product', 'Acquisition', 'Retail', 'Margin', 'Profit/Unit', 'Strategy', 'Stock'].map((h) => (
                    <th key={h} style={{ textAlign: h === 'Product' ? 'left' : 'right', padding: '10px 8px', color: '#949eb2', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </>
              ) : (
                <>
                  {['Product', 'Brand', 'Price', 'Availability', 'Category'].map((h) => (
                    <th key={h} style={{ textAlign: h === 'Product' ? 'left' : 'right', padding: '10px 8px', color: '#949eb2', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {viewMode === 'admin' ? (
              economics.map((item, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #1a1d27' }}>
                  <td style={{ padding: '10px 8px', color: '#f0f3f8', fontSize: '13px', fontWeight: 500 }}>{item.name}</td>
                  <td style={{ padding: '10px 8px', textAlign: 'right', color: '#949eb2', fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px' }}>KSh {item.acquisitionCost?.toLocaleString()}</td>
                  <td style={{ padding: '10px 8px', textAlign: 'right', color: '#f0f3f8', fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', fontWeight: 600 }}>KSh {item.retailPrice?.toLocaleString()}</td>
                  <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                    <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, background: item.grossMargin >= 25 ? '#2dd4bf15' : '#f59e0b15', color: item.grossMargin >= 25 ? '#2dd4bf' : '#f59e0b' }}>
                      {item.grossMargin}%
                    </span>
                  </td>
                  <td style={{ padding: '10px 8px', textAlign: 'right', color: '#2dd4bf', fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px' }}>KSh {item.profitPerUnit?.toLocaleString()}</td>
                  <td style={{ padding: '10px 8px', textAlign: 'right', color: '#949eb2', fontSize: '11px' }}>{item.pricingStrategy}</td>
                  <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                    <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, background: item.totalStock > 0 ? '#2dd4bf15' : '#ef444415', color: item.totalStock > 0 ? '#2dd4bf' : '#ef4444' }}>
                      {item.totalStock > 0 ? `${item.totalStock} units` : 'Out of stock'}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              publicFeed.map((item, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #1a1d27' }}>
                  <td style={{ padding: '10px 8px', color: '#f0f3f8', fontSize: '13px', fontWeight: 500 }}>{item.name}</td>
                  <td style={{ padding: '10px 8px', textAlign: 'right', color: '#949eb2', fontSize: '12px' }}>{item.brand}</td>
                  <td style={{ padding: '10px 8px', textAlign: 'right', color: '#f0f3f8', fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', fontWeight: 600 }}>KSh {item.price?.toLocaleString()}</td>
                  <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                    <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, background: item.availability === 'in_stock' ? '#2dd4bf15' : '#ef444415', color: item.availability === 'in_stock' ? '#2dd4bf' : '#ef4444' }}>
                      {item.availability === 'in_stock' ? 'In Stock' : 'Out of Stock'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 8px', textAlign: 'right', color: '#949eb2', fontSize: '12px' }}>{item.category}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
