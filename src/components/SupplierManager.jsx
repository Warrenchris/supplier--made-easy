import { useState, useEffect } from 'react';
import { 
  Store, Plus, Star, Clock, ShieldCheck, RefreshCw, 
  Check, ChevronDown, ChevronUp, Zap, ExternalLink, 
  Building2, Calendar, DollarSign, Award, X
} from 'lucide-react';

export default function SupplierManager() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [expandedSupplier, setExpandedSupplier] = useState(null);
  const [newSup, setNewSup] = useState({
    name: '',
    contact_info: '',
    currency_default: 'KES',
    reliability_score: 8.5,
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
      console.error('Failed to fetch suppliers:', err);
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
      setShowAddModal(false);
      setNewSup({
        name: '',
        contact_info: '',
        currency_default: 'KES',
        reliability_score: 8.5,
        avg_delivery_days: 3,
        warranty_terms_default: '1 Year Warranty'
      });
      fetchSuppliers();
    } catch (err) {
      console.error('Failed to create supplier:', err);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
        <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite', marginBottom: '8px' }} />
        <div>Loading Supplier Intelligence Directory...</div>
      </div>
    );
  }

  return (
    <div className="animate-fade" style={{ maxWidth: '1280px', margin: '0 auto' }}>
      
      {/* ─── Header & Action Bar ─── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--forest-text)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
            Vendor Directory
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Supplier Intelligence & Reliability Matrix
          </h1>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Multi-vendor performance profiles, lead time benchmarks, and explainable 6-metric intelligence matrices.
          </p>
        </div>

        <button onClick={() => setShowAddModal(true)} className="btn-primary" style={{ fontSize: '12px' }}>
          <Plus size={14} /> Add Supplier Profile
        </button>
      </div>

      {/* ─── Supplier Profiles Grid ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '16px' }}>
        {suppliers.map((sup) => {
          const isExpanded = expandedSupplier === sup.id;
          const reliabilityPct = Math.round((sup.reliability_score || 8.0) * 10);
          const deliveryDays = sup.avg_delivery_days || 3;
          const deliveryScore = deliveryDays <= 1 ? 100 : deliveryDays <= 2 ? 90 : deliveryDays <= 3 ? 80 : 65;
          const warrantyText = String(sup.warranty_terms_default || '').toLowerCase();
          const warrantyScore = warrantyText.includes('2 year') || warrantyText.includes('3 year') ? 95 : 80;
          const overallScore = Math.round((reliabilityPct * 0.4) + (deliveryScore * 0.3) + (warrantyScore * 0.3));

          return (
            <div key={sup.id} className="panel" style={{ padding: '18px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                  <div>
                    <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                      {sup.name}
                    </h3>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {sup.contact_info || 'Direct Wholesaler'}
                    </div>
                  </div>

                  <span className={`badge ${overallScore >= 85 ? 'badge-forest' : 'badge-neutral'}`}>
                    {sup.currency_default || 'KES'}
                  </span>
                </div>

                {/* KPI Metrics */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', padding: '10px 0', borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)', marginBottom: '14px' }}>
                  <div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Reliability</div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                      {sup.reliability_score || 8.0}/10
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Avg Lead Time</div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                      {deliveryDays} {deliveryDays === 1 ? 'day' : 'days'}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Vendor Score</div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--forest-bright)', fontFamily: 'var(--font-mono)' }}>
                      {overallScore}/100
                    </div>
                  </div>
                </div>

                {/* ─── Horizontal 6-Metric Intelligence Matrix ─── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  
                  {/* Reliability Metric */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '3px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Historical Reliability</span>
                      <span className="font-mono" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{reliabilityPct}%</span>
                    </div>
                    <div style={{ height: '5px', backgroundColor: 'var(--bg-primary)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ width: `${reliabilityPct}%`, height: '100%', backgroundColor: 'var(--forest-primary)' }} />
                    </div>
                  </div>

                  {/* Delivery Metric */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '3px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Delivery Lead Time</span>
                      <span className="font-mono" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{deliveryScore}%</span>
                    </div>
                    <div style={{ height: '5px', backgroundColor: 'var(--bg-primary)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ width: `${deliveryScore}%`, height: '100%', backgroundColor: 'var(--forest-primary)' }} />
                    </div>
                  </div>

                  {/* Warranty Terms */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '3px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Warranty Quality</span>
                      <span className="font-mono" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{warrantyScore}%</span>
                    </div>
                    <div style={{ height: '5px', backgroundColor: 'var(--bg-primary)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ width: `${warrantyScore}%`, height: '100%', backgroundColor: 'var(--copper-primary)' }} />
                    </div>
                  </div>

                </div>

              </div>

              {/* Footer */}
              <div style={{ marginTop: '14px', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--text-muted)' }}>
                <span>Default: {sup.warranty_terms_default || '1 Year Warranty'}</span>
                <span className="badge badge-neutral" style={{ fontSize: '10px' }}>Active Sourcing</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── Add Supplier Modal ─── */}
      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="panel" style={{ maxWidth: '480px', width: '100%', padding: '24px', backgroundColor: 'var(--bg-surface)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                Register New Supplier Profile
              </h3>
              <button onClick={() => setShowAddModal(false)} className="btn-ghost" style={{ padding: '4px' }}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateSupplier} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                  Supplier Legal / Trading Name *
                </label>
                <input
                  required
                  value={newSup.name}
                  onChange={(e) => setNewSup({ ...newSup, name: e.target.value })}
                  placeholder="e.g. Apex Hardware Nairobi Ltd"
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                    Default Currency
                  </label>
                  <select
                    value={newSup.currency_default}
                    onChange={(e) => setNewSup({ ...newSup, currency_default: e.target.value })}
                    style={{ width: '100%' }}
                  >
                    <option value="KES">KES (Kenyan Shilling)</option>
                    <option value="USD">USD (US Dollar)</option>
                    <option value="EUR">EUR (Euro)</option>
                    <option value="GBP">GBP (British Pound)</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                    Reliability Rating (0-10)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    max="10"
                    value={newSup.reliability_score}
                    onChange={(e) => setNewSup({ ...newSup, reliability_score: parseFloat(e.target.value) || 8.0 })}
                    className="font-mono"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                    Average Delivery (Days)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="90"
                    value={newSup.avg_delivery_days}
                    onChange={(e) => setNewSup({ ...newSup, avg_delivery_days: parseInt(e.target.value) || 3 })}
                    className="font-mono"
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                    Warranty Terms
                  </label>
                  <input
                    value={newSup.warranty_terms_default}
                    onChange={(e) => setNewSup({ ...newSup, warranty_terms_default: e.target.value })}
                    placeholder="e.g. 1 Year Warranty"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                  Contact Information / Email
                </label>
                <input
                  value={newSup.contact_info}
                  onChange={(e) => setNewSup({ ...newSup, contact_info: e.target.value })}
                  placeholder="orders@supplier.co.ke"
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                <button type="button" onClick={() => setShowAddModal(false)} className="btn-secondary" style={{ fontSize: '12px' }}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" style={{ fontSize: '12px' }}>
                  <Check size={14} /> Save Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
