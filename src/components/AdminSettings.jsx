import { useState, useEffect } from 'react';
import { Sliders, RefreshCw, DollarSign, ShieldAlert, FileText, Check, Download, Layers } from 'lucide-react';

export default function AdminSettings() {
  const [weights, setWeights] = useState({
    w1_price: 0.40,
    w2_stock: 0.25,
    w3_reliability: 0.20,
    w4_delivery: 0.10,
    w5_warranty: 0.05
  });
  const [fxRates, setFxRates] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [draftPOs, setDraftPOs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savedMsg, setSavedMsg] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resSettings, resFx, resPo] = await Promise.all([
        fetch('/api/admin/settings').then((r) => r.json()),
        fetch('/api/exchange-rates').then((r) => r.json()),
        fetch('/api/purchase-orders/draft', { method: 'POST' }).then((r) => r.json())
      ]);

      if (resSettings.scoringWeights) setWeights(resSettings.scoringWeights);
      if (resSettings.auditLogs) setAuditLogs(resSettings.auditLogs);
      setFxRates(resFx);
      setDraftPOs(resPo);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSaveWeights = async () => {
    try {
      await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scoringWeights: weights })
      });
      setSavedMsg('Scoring formula weights updated successfully!');
      setTimeout(() => setSavedMsg(''), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateFx = async (currency_code, rate_to_base) => {
    try {
      await fetch('/api/exchange-rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currency_code, rate_to_base })
      });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return <div style={{ color: '#949eb2', padding: '24px', textAlign: 'center' }}>Loading Admin Control Room...</div>;
  }

  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto', color: '#f0f3f8' }}>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sliders size={22} color="#2dd4bf" /> Admin Control Room & Procurement Configuration
        </h2>
        <p style={{ fontSize: '13px', color: '#949eb2', marginTop: '4px' }}>
          Tune recommendation formula weights, manage exchange rates (KES base currency), view audit trails, and export draft purchase orders.
        </p>
      </div>

      {savedMsg && (
        <div style={{ background: 'rgba(45, 212, 191, 0.15)', color: '#2dd4bf', border: '1px solid #2dd4bf', padding: '10px 16px', borderRadius: '8px', marginBottom: '20px', fontSize: '13px', fontWeight: 600 }}>
          ✓ {savedMsg}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        
        {/* Recommendation Scoring Weight Sliders */}
        <div style={{ background: '#181b24', border: '1px solid #2b303d', borderRadius: '14px', padding: '20px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sliders size={18} color="#2dd4bf" /> Weighted Scoring Formula Sliders
          </h3>
          <p style={{ fontSize: '12px', color: '#949eb2', marginBottom: '16px' }}>
            Adjust the importance of each parameter when calculating the <strong>Recommended Sourcing Supplier</strong>.
          </p>

          {[
            ['w1_price', 'Price Competitiveness (Lower = Higher)', weights.w1_price],
            ['w2_stock', 'Stock Availability & Quantity', weights.w2_stock],
            ['w3_reliability', 'Supplier Historical Reliability', weights.w3_reliability],
            ['w4_delivery', 'Delivery Speed & Lead Time', weights.w4_delivery],
            ['w5_warranty', 'Warranty Terms & Support', weights.w5_warranty]
          ].map(([key, label, val]) => (
            <div key={key} style={{ marginBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                <span>{label}</span>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, color: '#2dd4bf' }}>
                  {Math.round(val * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={val}
                onChange={(e) => setWeights({ ...weights, [key]: parseFloat(e.target.value) })}
                style={{ width: '100%', accentColor: '#2dd4bf', cursor: 'pointer' }}
              />
            </div>
          ))}

          <button
            onClick={handleSaveWeights}
            style={{ background: '#2dd4bf', border: 'none', color: '#042f2e', fontWeight: 700, padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', width: '100%', justifyContent: 'center', marginTop: '10px' }}
          >
            <Check size={16} /> Apply Formula Weights
          </button>
        </div>

        {/* Exchange Rate Manager */}
        <div style={{ background: '#181b24', border: '1px solid #2b303d', borderRadius: '14px', padding: '20px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <DollarSign size={18} color="#3b82f6" /> Base Currency Exchange Rates (Base: KES)
          </h3>
          <p style={{ fontSize: '12px', color: '#949eb2', marginBottom: '16px' }}>
            Multi-currency pricelists are dynamically normalized into Kenyan Shillings (KES).
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {fxRates.map((r) => (
              <div key={r.currency_code} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#202430', padding: '10px 14px', borderRadius: '8px' }}>
                <div>
                  <span style={{ fontWeight: 700, fontSize: '14px' }}>1 {r.currency_code} = </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="number"
                    step="0.1"
                    defaultValue={r.rate_to_base}
                    onBlur={(e) => handleUpdateFx(r.currency_code, parseFloat(e.target.value))}
                    style={{ background: '#0f1117', border: '1px solid #2b303d', borderRadius: '6px', color: '#2dd4bf', padding: '4px 8px', fontSize: '13px', fontWeight: 700, width: '100px', textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace" }}
                  />
                  <span style={{ fontSize: '12px', color: '#949eb2' }}>KES</span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Draft Purchase Orders Summary */}
      <div style={{ background: '#181b24', border: '1px solid #2b303d', borderRadius: '14px', padding: '20px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={18} color="#2dd4bf" /> Draft Purchase Orders (Batched by Recommended Supplier)
            </h3>
            <p style={{ fontSize: '12px', color: '#949eb2', marginTop: '2px' }}>
              Automatically groups all active products by their highest-scoring sourcing supplier to streamline procurement.
            </p>
          </div>
        </div>

        {draftPOs.length === 0 ? (
          <div style={{ fontSize: '13px', color: '#949eb2' }}>No draft purchase orders generated yet.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '14px' }}>
            {draftPOs.map((group, gIdx) => {
              const totalKes = group.items.reduce((sum, i) => sum + (i.price_in_base_currency || 0), 0);
              return (
                <div key={gIdx} style={{ background: '#202430', border: '1px solid #2b303d', borderRadius: '10px', padding: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ fontWeight: 700, fontSize: '14px', color: '#2dd4bf' }}>{group.supplier?.name}</div>
                    <span style={{ fontSize: '11px', background: '#0f1117', padding: '2px 6px', borderRadius: '4px', color: '#949eb2' }}>
                      {group.items.length} Line Items
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#949eb2', marginBottom: '10px' }}>
                    Est. PO Total: <strong style={{ color: '#f0f3f8', fontFamily: "'IBM Plex Mono', monospace" }}>{totalKes.toLocaleString(undefined, { minimumFractionDigits: 2 })} KES</strong>
                  </div>
                  <div style={{ fontSize: '11px', color: '#949eb2', maxHeight: '100px', overflowY: 'auto' }}>
                    {group.items.map((it, iIdx) => (
                      <div key={iIdx} style={{ padding: '2px 0', borderBottom: '1px solid #181b24' }}>
                        • {it.canonical_name} ({it.price} {it.currency})
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
