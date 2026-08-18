import { useState, useEffect } from 'react';
import { 
  Cpu, Check, ArrowRight, ShieldCheck, DollarSign, 
  Truck, Award, AlertTriangle, Layers, FileCheck, 
  ChevronRight, RefreshCw, BarChart2, Target, Zap
} from 'lucide-react';
import api from '../services/apiClient';
import { useToast } from '../context/ToastContext';

export default function ProcurementOptimizer({ preselectedProduct }) {
  const [products, setProducts] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState(preselectedProduct?.id || '');
  const [quantity, setQuantity] = useState(10);
  const [mode, setMode] = useState('best_value');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
  const toast = useToast();

  useEffect(() => {
    api.get('/api/canonical-products')
      .then((data) => {
        const prods = Array.isArray(data) ? data : [];
        setProducts(prods);
        if (preselectedProduct && preselectedProduct.id) {
          setSelectedProductId(preselectedProduct.id);
        } else if (prods.length > 0 && !selectedProductId) {
          setSelectedProductId(prods[0].id);
        }
      })
      .catch((err) => {
        toast.error(err.message, 'Failed to Load Products');
      });
  }, [preselectedProduct]);

  const selectedProduct = products.find((p) => p.id === selectedProductId);

  const runOptimization = async () => {
    if (!selectedProductId || !quantity) return;
    setLoading(true);
    setResult(null);
    setSaveSuccessMsg('');
    try {
      const data = await api.post('/api/procurement/optimize', {
        canonicalProductId: selectedProductId,
        quantity: parseInt(quantity) || 1,
        mode
      });
      setResult(data);
    } catch (err) {
      setResult({ success: false, error: err.message });
      toast.error(err.message, 'Optimizer Calculation Failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedProductId) {
      runOptimization();
    }
  }, [selectedProductId, mode]);

  const handleSaveDecision = async () => {
    if (!selectedProductId || !result?.success) return;
    setSaving(true);
    try {
      const data = await api.post('/api/procurement/decide', {
        canonicalProductId: selectedProductId,
        quantity: parseInt(quantity),
        mode
      });
      if (data.success) {
        setSaveSuccessMsg(`Decision snapshot committed successfully (ID: ${data.decision.id})`);
        toast.success(`Purchase allocation of ${quantity} units locked across ${data.decision.allocations?.length || 1} suppliers.`, 'Sourcing Decision Committed');
        setTimeout(() => setSaveSuccessMsg(''), 4000);
      }
    } catch (err) {
      toast.error(err.message, 'Failed to Commit Decision');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="animate-fade" style={{ maxWidth: '1100px', margin: '0 auto' }}>
      
      {/* ─── Header ─── */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--forest-text)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
          Algorithmic Sourcing Engine
        </div>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
          Multi-Supplier Procurement Optimizer
        </h1>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
          Determine the most mathematically optimal multi-supplier allocation constrained by inventory, delivery lead times, and reliability.
        </p>
      </div>

      {saveSuccessMsg && (
        <div className="panel" style={{ padding: '12px 16px', marginBottom: '16px', background: 'var(--color-success-bg)', borderColor: 'rgba(47, 107, 82, 0.4)', color: 'var(--color-success-text)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle2 size={16} /> {saveSuccessMsg}
        </div>
      )}

      {/* ─── Parameter Configuration Panel ─── */}
      <div className="panel" style={{ padding: '18px 20px', marginBottom: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 120px 240px 140px', gap: '16px', alignItems: 'end' }}>
          
          {/* Product Picker */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
              Target Product
            </label>
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              style={{ width: '100%', cursor: 'pointer', fontWeight: 500 }}
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.canonical_name} ({p.offers?.length || 0} quotes)
                </option>
              ))}
            </select>
          </div>

          {/* Quantity */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
              Batch Qty
            </label>
            <input
              type="number"
              min="1"
              max="10000"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              onBlur={runOptimization}
              className="font-mono"
              style={{ width: '100%', textAlign: 'center', fontWeight: 600 }}
            />
          </div>

          {/* Strategy Mode Switcher */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
              Optimization Objective
            </label>
            <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-primary)', padding: '3px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              <button
                type="button"
                onClick={() => setMode('best_value')}
                style={{
                  flex: 1,
                  padding: '6px 8px',
                  fontSize: '11px',
                  borderRadius: 'var(--radius-xs)',
                  backgroundColor: mode === 'best_value' ? 'var(--bg-elevated)' : 'transparent',
                  color: mode === 'best_value' ? 'var(--forest-bright)' : 'var(--text-muted)',
                  border: `1px solid ${mode === 'best_value' ? 'var(--forest-border)' : 'transparent'}`
                }}
              >
                <Zap size={12} /> Best Value
              </button>
              <button
                type="button"
                onClick={() => setMode('lowest_cost')}
                style={{
                  flex: 1,
                  padding: '6px 8px',
                  fontSize: '11px',
                  borderRadius: 'var(--radius-xs)',
                  backgroundColor: mode === 'lowest_cost' ? 'var(--bg-elevated)' : 'transparent',
                  color: mode === 'lowest_cost' ? 'var(--copper-text)' : 'var(--text-muted)',
                  border: `1px solid ${mode === 'lowest_cost' ? 'var(--copper-border)' : 'transparent'}`
                }}
              >
                <DollarSign size={12} /> Lowest Cost
              </button>
            </div>
          </div>

          {/* Action Trigger */}
          <div>
            <button
              onClick={runOptimization}
              disabled={loading || !selectedProductId}
              className="btn-primary"
              style={{ width: '100%', padding: '9px', fontSize: '12px' }}
            >
              {loading ? (
                <>
                  <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> Computing...
                </>
              ) : (
                <>
                  <Target size={14} /> Re-Optimize
                </>
              )}
            </button>
          </div>

        </div>
      </div>

      {/* ─── Optimization Results Presentation ─── */}
      {result && (
        <div className="animate-fade">
          
          {/* Failure Case */}
          {!result.success ? (
            <div className="panel" style={{ padding: '24px', borderColor: 'rgba(185, 74, 72, 0.4)', background: 'var(--bg-surface)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--color-danger-text)', marginBottom: '8px' }}>
                <AlertCircle size={20} />
                <h3 style={{ fontSize: '15px', fontWeight: 600, margin: 0 }}>Procurement Constraint Shortfall</h3>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
                {result.error}
              </p>
              {result.reasoning && (
                <div style={{ background: 'var(--bg-primary)', padding: '12px 16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                    Diagnostics
                  </div>
                  <ul style={{ paddingLeft: '18px', fontSize: '12px', color: 'var(--text-muted)' }}>
                    {result.reasoning.map((r, i) => (
                      <li key={i} style={{ marginBottom: '2px' }}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            /* Success Solution */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* Solution Summary Card */}
              <div className="panel" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', paddingBottom: '16px', borderBottom: '1px solid var(--border-subtle)' }}>
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--forest-text)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Recommended Sourcing Allocation
                    </div>
                    <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                      {result.requestedQuantity} Units Total Fulfillment
                    </h2>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Fulfillment strategy: <strong style={{ color: 'var(--text-secondary)' }}>{mode === 'best_value' ? 'Best Value (Risk-Weighted)' : 'Pure Lowest Acquisition Cost'}</strong>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '24px', textAlign: 'right' }}>
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Acquisition Cost</div>
                      <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                        KSh {result.totalCost.toLocaleString()}
                      </div>
                    </div>

                    {result.saving > 0 && (
                      <div>
                        <div style={{ fontSize: '11px', color: 'var(--copper-text)', textTransform: 'uppercase' }}>Arbitrage Savings</div>
                        <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--copper-text)', fontFamily: 'var(--font-mono)' }}>
                          KSh {result.saving.toLocaleString()}
                          <span style={{ fontSize: '12px', fontWeight: 500, marginLeft: '4px' }}>({result.savingPercent}%)</span>
                        </div>
                      </div>
                    )}

                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Confidence</div>
                      <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--forest-bright)', fontFamily: 'var(--font-mono)' }}>
                        {result.confidence}%
                      </div>
                    </div>
                  </div>
                </div>

                {/* Visual Allocation Breakdown Bars */}
                <div style={{ paddingTop: '16px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '10px' }}>
                    Multi-Supplier Allocation Distribution
                  </div>

                  {/* Multi-segment bar */}
                  <div style={{ height: '24px', display: 'flex', borderRadius: 'var(--radius-xs)', overflow: 'hidden', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-default)', marginBottom: '12px' }}>
                    {result.allocations.map((a, idx) => {
                      const pct = Math.round((a.quantity / result.requestedQuantity) * 100);
                      const bg = idx === 0 ? 'var(--forest-primary)' : idx === 1 ? 'var(--copper-primary)' : '#4E5A54';
                      return (
                        <div
                          key={a.supplier.id}
                          style={{
                            width: `${pct}%`,
                            backgroundColor: bg,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '10px',
                            fontWeight: 700,
                            color: '#FFFFFF',
                            fontFamily: 'var(--font-mono)',
                            borderRight: idx < result.allocations.length - 1 ? '1px solid var(--bg-surface)' : 'none'
                          }}
                          title={`${a.supplier.name}: ${a.quantity} units (${pct}%)`}
                        >
                          {pct >= 15 ? `${a.quantity} units (${pct}%)` : `${a.quantity}`}
                        </div>
                      );
                    })}
                  </div>

                  {/* Supplier Allocation Line Items */}
                  <div style={{ display: 'grid', gridTemplateColumns: `repeat(${result.allocations.length}, 1fr)`, gap: '12px' }}>
                    {result.allocations.map((a, idx) => (
                      <div key={a.supplier.id} className="panel" style={{ padding: '12px 14px', background: 'var(--bg-elevated)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <span style={{ fontWeight: 600, fontSize: '12px', color: 'var(--text-primary)' }}>{a.supplier.name}</span>
                          <span className="badge badge-forest">{a.score}/100</span>
                        </div>
                        <div style={{ fontSize: '13px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                          {a.quantity} units × KSh {a.unitCost.toLocaleString()}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                          Subtotal: KSh {a.subtotal.toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Alternative Comparison Note */}
                {result.alternative && (
                  <div style={{ marginTop: '16px', padding: '10px 14px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                    <div style={{ color: 'var(--text-muted)' }}>
                      <strong>Single-Source Alternative:</strong> {result.alternative.description}
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      KSh {result.alternative.totalCost.toLocaleString()}
                    </div>
                  </div>
                )}

              </div>

              {/* Decision Explanation & Commitment Action Panel */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
                
                <div className="panel" style={{ padding: '18px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                    <Info size={15} color="var(--forest-bright)" /> Sourcing Decision Logic
                  </div>
                  <ul style={{ paddingLeft: '18px', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    {result.reasoning.map((reason, idx) => (
                      <li key={idx}>{reason}</li>
                    ))}
                  </ul>
                </div>

                <div className="panel" style={{ padding: '18px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                      Commit Sourcing Decision
                    </div>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                      Records an immutable snapshot of this procurement allocation for audit, purchase order drafting, and price tracking.
                    </p>
                  </div>

                  <button 
                    onClick={handleSaveDecision}
                    className="btn-copper"
                    style={{ width: '100%', marginTop: '14px', fontSize: '12px' }}
                  >
                    <FileCheck size={14} /> Commit Snapshot
                  </button>
                </div>

              </div>

            </div>
          )}

        </div>
      )}

    </div>
  );
}
