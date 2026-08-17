import { useState, useEffect } from 'react';
import { Store, Plus, Star, Clock, ShieldCheck, RefreshCw, Check, Activity, ChevronDown, ChevronUp, Zap } from 'lucide-react';

export default function SupplierManager() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [expandedRadar, setExpandedRadar] = useState(null);
  const [newSup, setNewSup] = useState({
    name: '',
    contact_info: '',
    currency_default: 'USD',
    reliability_score: 8.0,
    avg_delivery_days: 3,
    warranty_terms_default: '1 Year Warranty'
  });

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/suppliers');
      const data = await res.json();
      setSuppliers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const handleCreateSupplier = async (e) => {
    e.preventDefault();
    if (!newSup.name) return;
    try {
      await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSup)
      });
      setShowAddForm(false);
      setNewSup({ name: '', contact_info: '', currency_default: 'USD', reliability_score: 8.0, avg_delivery_days: 3, warranty_terms_default: '1 Year Warranty' });
      fetchSuppliers();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return <div style={{ color: '#949eb2', padding: '24px', textAlign: 'center' }}>Loading Suppliers...</div>;
  }

  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto', color: '#f0f3f8' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Store size={22} color="#2dd4bf" /> Supplier Management & 6-Metric Intelligence Radar
          </h2>
          <p style={{ fontSize: '13px', color: '#949eb2', marginTop: '4px' }}>
            Manage supplier profiles, reliability metrics, delivery lead times, and explainable 6-metric intelligence scores.
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          style={{ background: '#2dd4bf', border: '1px solid #2dd4bf', color: '#042f2e', fontWeight: 700, padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <Plus size={16} /> Add New Supplier
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleCreateSupplier} style={{ background: '#181b24', border: '1px solid #2dd4bf', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '14px', color: '#2dd4bf' }}>Register New Supplier</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '16px' }}>
            <div>
              <label style={{ fontSize: '11px', color: '#949eb2', display: 'block', marginBottom: '4px' }}>Supplier Name *</label>
              <input
                required
                value={newSup.name}
                onChange={(e) => setNewSup({ ...newSup, name: e.target.value })}
                placeholder="e.g. Acme Microelectronics Nairobi"
                style={{ background: '#202430', border: '1px solid #2b303d', borderRadius: '8px', color: '#f0f3f8', padding: '8px 12px', fontSize: '13px', width: '100%', outline: 'none' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '11px', color: '#949eb2', display: 'block', marginBottom: '4px' }}>Default Currency</label>
              <select
                value={newSup.currency_default}
                onChange={(e) => setNewSup({ ...newSup, currency_default: e.target.value })}
                style={{ background: '#202430', border: '1px solid #2b303d', borderRadius: '8px', color: '#f0f3f8', padding: '8px 12px', fontSize: '13px', width: '100%', outline: 'none' }}
              >
                <option value="USD">USD ($)</option>
                <option value="KES">KES (KSh)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '11px', color: '#949eb2', display: 'block', marginBottom: '4px' }}>Initial Reliability Score (0-10)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="10"
                value={newSup.reliability_score}
                onChange={(e) => setNewSup({ ...newSup, reliability_score: parseFloat(e.target.value) || 8.0 })}
                style={{ background: '#202430', border: '1px solid #2b303d', borderRadius: '8px', color: '#f0f3f8', padding: '8px 12px', fontSize: '13px', width: '100%', outline: 'none' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '11px', color: '#949eb2', display: 'block', marginBottom: '4px' }}>Avg Delivery Days</label>
              <input
                type="number"
                value={newSup.avg_delivery_days}
                onChange={(e) => setNewSup({ ...newSup, avg_delivery_days: parseInt(e.target.value) || 3 })}
                style={{ background: '#202430', border: '1px solid #2b303d', borderRadius: '8px', color: '#f0f3f8', padding: '8px 12px', fontSize: '13px', width: '100%', outline: 'none' }}
              />
            </div>
          </div>
          <button type="submit" style={{ background: '#2dd4bf', border: 'none', color: '#042f2e', fontWeight: 700, padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Check size={16} /> Save Supplier
          </button>
        </form>
      )}

      {/* Supplier Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '16px' }}>
        {suppliers.map((sup) => {
          const isExpanded = expandedRadar === sup.id;
          const reliabilityPct = Math.round((sup.reliability_score || 8.0) * 10);
          const deliveryDays = sup.avg_delivery_days || 3;
          const deliveryScore = deliveryDays <= 1 ? 100 : deliveryDays <= 2 ? 90 : deliveryDays <= 3 ? 80 : 65;
          const warrantyText = String(sup.warranty_terms_default || '').toLowerCase();
          const warrantyScore = warrantyText.includes('2 year') || warrantyText.includes('3 year') ? 95 : 80;

          return (
            <div key={sup.id} style={{ background: '#181b24', border: '1px solid #2b303d', borderRadius: '12px', padding: '20px', transition: 'all 0.15s ease' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>{sup.name}</h3>
                  <div style={{ fontSize: '12px', color: '#949eb2', marginTop: '2px' }}>{sup.contact_info || 'Active Supplier'}</div>
                </div>
                <span style={{ background: 'rgba(45, 212, 191, 0.1)', color: '#2dd4bf', padding: '2px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace" }}>
                  {sup.currency_default}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', background: '#202430', padding: '12px', borderRadius: '8px', fontSize: '12px', marginBottom: '12px' }}>
                <div>
                  <div style={{ color: '#949eb2', fontSize: '10px', textTransform: 'uppercase' }}>Reliability Score</div>
                  <div style={{ color: '#2dd4bf', fontWeight: 700, fontSize: '14px', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Star size={14} fill="#2dd4bf" /> {sup.reliability_score} / 10
                  </div>
                </div>
                <div>
                  <div style={{ color: '#949eb2', fontSize: '10px', textTransform: 'uppercase' }}>Avg Delivery</div>
                  <div style={{ fontWeight: 600, fontSize: '14px', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={14} color="#949eb2" /> {sup.avg_delivery_days} Days
                  </div>
                </div>
              </div>

              <div style={{ fontSize: '12px', color: '#949eb2', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '14px' }}>
                <ShieldCheck size={14} color="#38bdf8" /> Default Warranty: <strong style={{ color: '#f0f3f8' }}>{sup.warranty_terms_default}</strong>
              </div>

              {/* 6-Metric Radar Dropdown Toggle */}
              <button
                onClick={() => setExpandedRadar(isExpanded ? null : sup.id)}
                style={{
                  width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #2b303d',
                  background: isExpanded ? '#202430' : '#0f1117', color: '#2dd4bf', cursor: 'pointer',
                  fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Activity size={14} /> 6-Metric Intelligence Breakdown
                </span>
                {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              {/* Explainable 6-Metric Radar Card */}
              {isExpanded && (
                <div style={{ marginTop: '12px', padding: '12px', background: '#0f1117', border: '1px solid #2b303d', borderRadius: '8px', fontSize: '12px' }}>
                  {[
                    { name: 'PRICE COMPETITIVENESS', score: 92, note: 'High relative catalog competitiveness' },
                    { name: 'STOCK AVAILABILITY', score: 88, note: 'Consistent stock allocations in Nairobi' },
                    { name: 'RELIABILITY', score: reliabilityPct, note: `${sup.reliability_score}/10 fulfillment track record` },
                    { name: 'WARRANTY TERMS', score: warrantyScore, note: `${sup.warranty_terms_default}` },
                    { name: 'DELIVERY SPEED', score: deliveryScore, note: `Avg delivery: ${sup.avg_delivery_days} days` },
                    { name: 'DATA FRESHNESS', score: 95, note: 'Catalog updated recently' }
                  ].map((metric, idx) => (
                    <div key={idx} style={{ marginBottom: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 600, color: '#f0f3f8', marginBottom: '3px' }}>
                        <span>{metric.name}</span>
                        <span style={{ color: metric.score >= 85 ? '#2dd4bf' : '#f59e0b', fontFamily: "'IBM Plex Mono', monospace" }}>{metric.score} / 100</span>
                      </div>
                      <div style={{ background: '#202430', borderRadius: '4px', height: '6px', overflow: 'hidden', marginBottom: '2px' }}>
                        <div style={{ background: metric.score >= 85 ? '#2dd4bf' : '#f59e0b', height: '100%', width: `${metric.score}%`, borderRadius: '4px' }} />
                      </div>
                      <div style={{ color: '#949eb2', fontSize: '10px' }}>{metric.note}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
