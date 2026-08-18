import { useState, useEffect } from 'react';
import { 
  Sliders, RefreshCw, DollarSign, ShieldAlert, 
  FileText, Check, Download, Layers, ShieldCheck, 
  Plus, History, Settings
} from 'lucide-react';
import api from '../services/apiClient';
import { useToast } from '../context/ToastContext';

export default function AdminSettings() {
  const [weights, setWeights] = useState({
    w1_price: 0.30,
    w2_stock: 0.20,
    w3_reliability: 0.20,
    w4_delivery: 0.10,
    w5_warranty: 0.10,
    w6_freshness: 0.10
  });
  const [fxRates, setFxRates] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [draftPOs, setDraftPOs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savedMsg, setSavedMsg] = useState('');
  const [newCurrency, setNewCurrency] = useState({ code: 'USD', rate: 129.50 });
  const toast = useToast();

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resSettings, resFx, resPo] = await Promise.all([
        api.get('/api/admin/settings'),
        api.get('/api/exchange-rates'),
        api.post('/api/purchase-orders/draft')
      ]);

      if (resSettings?.scoringWeights) setWeights(resSettings.scoringWeights);
      if (resSettings?.auditLogs) setAuditLogs(resSettings.auditLogs);
      setFxRates(Array.isArray(resFx) ? resFx : []);
      setDraftPOs(Array.isArray(resPo) ? resPo : []);
    } catch (err) {
      toast.error(err.message, 'Failed to Load Settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSaveWeights = async () => {
    const totalWeight = Object.values(weights).reduce((a, b) => a + Number(b), 0);
    if (Math.abs(totalWeight - 1.0) > 0.02) {
      toast.warning(
        `Formula weights currently sum to ${Math.round(totalWeight * 100)}%. For balanced scoring, ensure weights sum to 100%.`,
        'Unbalanced Formula Weights'
      );
    }

    try {
      await api.post('/api/admin/settings', { scoringWeights: weights });
      setSavedMsg('Scoring formula weights updated successfully.');
      toast.success('Supplier scoring weights successfully saved.', 'Formula Weights Updated');
      setTimeout(() => setSavedMsg(''), 3000);
    } catch (err) {
      toast.error(err.message, 'Failed to Save Settings');
    }
  };

  const handleUpdateFx = async (currency_code, rate_to_base) => {
    try {
      await api.post('/api/exchange-rates', { currency_code, rate_to_base });
      toast.success(`Exchange rate for ${currency_code} updated to ${rate_to_base} KES.`, 'Exchange Rate Saved');
      fetchData();
    } catch (err) {
      toast.error(err.message, 'Failed to Update Exchange Rate');
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
        <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite', marginBottom: '8px' }} />
        <div>Loading Admin Control Room...</div>
      </div>
    );
  }

  return (
    <div className="animate-fade" style={{ maxWidth: '1280px', margin: '0 auto' }}>
      
      {/* ─── Header ─── */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--forest-text)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
          System Administration
        </div>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
          Procurement Configuration & Control Room
        </h1>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
          Tune 6-metric recommendation formulas, maintain multi-currency foreign exchange rates (KES base), and inspect audit logs.
        </p>
      </div>

      {savedMsg && (
        <div className="panel" style={{ padding: '10px 16px', marginBottom: '16px', background: 'var(--color-success-bg)', color: 'var(--color-success-text)', fontSize: '12px' }}>
          ✓ {savedMsg}
        </div>
      )}

      {/* ─── 2-Column Split: Formula Weights & FX Rates ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
        
        {/* 6-Metric Formula Sliders */}
        <div className="panel" style={{ padding: '20px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
            <Sliders size={15} color="var(--forest-bright)" /> 6-Metric Scoring Formula Weights
          </div>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '16px' }}>
            Adjust parameter coefficients when calculating the Recommended Sourcing Supplier score.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[
              ['w1_price', 'Price Competitiveness (Lower = Higher)', weights.w1_price],
              ['w2_stock', 'Stock Availability & Quantity', weights.w2_stock],
              ['w3_reliability', 'Supplier Reliability Rating', weights.w3_reliability],
              ['w4_delivery', 'Delivery Speed & Lead Time', weights.w4_delivery],
              ['w5_warranty', 'Warranty Terms & Support', weights.w5_warranty],
              ['w6_freshness', 'Data Freshness & Recent Pricelist', weights.w6_freshness]
            ].map(([key, label, val]) => (
              <div key={key}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '3px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                  <span className="font-mono" style={{ color: 'var(--forest-bright)', fontWeight: 700 }}>
                    {Math.round((val || 0) * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={val || 0}
                  onChange={(e) => setWeights({ ...weights, [key]: parseFloat(e.target.value) })}
                  style={{ width: '100%', accentColor: 'var(--forest-primary)', cursor: 'pointer' }}
                />
              </div>
            ))}
          </div>

          <button
            onClick={handleSaveWeights}
            className="btn-primary"
            style={{ width: '100%', marginTop: '16px', fontSize: '12px' }}
          >
            <Check size={14} /> Apply Formula Weights
          </button>
        </div>

        {/* Foreign Exchange Rates Manager */}
        <div className="panel" style={{ padding: '20px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
            <DollarSign size={15} color="var(--copper-text)" /> Foreign Exchange Rates (Base Currency: KES)
          </div>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '16px' }}>
            Multi-currency pricelist lines are normalized into Kenyan Shillings (KES) using these rates.
          </p>

          {/* Active Rates Table */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
            {fxRates.map((r) => (
              <div key={r.currency_code} className="panel" style={{ padding: '10px 14px', background: 'var(--bg-elevated)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="badge badge-forest font-mono">{r.currency_code}</span>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>1 {r.currency_code} =</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input
                    type="number"
                    step="0.01"
                    defaultValue={r.rate_to_base}
                    onBlur={(e) => handleUpdateFx(r.currency_code, parseFloat(e.target.value))}
                    className="font-mono"
                    style={{ width: '90px', textAlign: 'right', fontWeight: 600, padding: '4px 8px', fontSize: '12px' }}
                    disabled={r.currency_code === 'KES'}
                  />
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>KES</span>
                </div>
              </div>
            ))}
          </div>

          {/* Add Currency Rate */}
          <div style={{ background: 'var(--bg-primary)', padding: '12px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
              Add / Update Exchange Rate
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                placeholder="USD / EUR"
                value={newCurrency.code}
                onChange={(e) => setNewCurrency({ ...newCurrency, code: e.target.value.toUpperCase() })}
                style={{ width: '100px', textTransform: 'uppercase' }}
              />
              <input
                type="number"
                step="0.01"
                placeholder="Rate in KES"
                value={newCurrency.rate}
                onChange={(e) => setNewCurrency({ ...newCurrency, rate: parseFloat(e.target.value) || 0 })}
                className="font-mono"
                style={{ flex: 1 }}
              />
              <button
                onClick={() => {
                  if (newCurrency.code && newCurrency.rate > 0) {
                    handleUpdateFx(newCurrency.code, newCurrency.rate);
                  }
                }}
                className="btn-secondary"
                style={{ fontSize: '12px' }}
              >
                Set Rate
              </button>
            </div>
          </div>

        </div>

      </div>

      {/* ─── Immutable Audit Logs ─── */}
      <div className="panel" style={{ overflow: 'hidden' }}>
        <div className="panel-header">
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <History size={15} color="var(--forest-bright)" /> System Audit Trail (Last 20 Actions)
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Immutable Ledger</span>
        </div>

        <table className="enterprise-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Action</th>
              <th>Target Entity</th>
              <th>Entity ID</th>
              <th>User</th>
            </tr>
          </thead>
          <tbody>
            {auditLogs.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '24px 16px', color: 'var(--text-muted)' }}>
                  No audit log entries recorded yet.
                </td>
              </tr>
            ) : (
              auditLogs.map((log) => (
                <tr key={log.id}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>
                    {log.created_at ? new Date(log.created_at).toLocaleString() : '—'}
                  </td>
                  <td>
                    <span className="badge badge-neutral font-mono">{log.action}</span>
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>{log.entity_type}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>
                    {log.entity_id}
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>{log.user_id || 'System'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}
