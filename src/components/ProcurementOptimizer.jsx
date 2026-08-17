import { useState, useEffect } from 'react';
import { Target, Zap, DollarSign, TrendingDown, ChevronDown, ChevronUp, AlertCircle, CheckCircle, HelpCircle } from 'lucide-react';

export default function ProcurementOptimizer() {
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [quantity, setQuantity] = useState(20);
  const [mode, setMode] = useState('best_value');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showReasoning, setShowReasoning] = useState(false);

  useEffect(() => {
    fetch('/api/canonical-products')
      .then((r) => r.json())
      .then((data) => setProducts(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  const runOptimization = async () => {
    if (!selectedProduct) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/procurement/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          canonicalProductId: selectedProduct.id,
          quantity,
          mode
        })
      });
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setResult({ success: false, error: err.message });
    }
    setLoading(false);
  };

  const saveDecision = async () => {
    if (!selectedProduct || !result?.success) return;
    try {
      const res = await fetch('/api/procurement/decide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          canonicalProductId: selectedProduct.id,
          quantity,
          mode
        })
      });
      const data = await res.json();
      if (data.success) {
        alert(`Procurement decision saved (ID: ${data.decision.id})`);
      }
    } catch (err) {
      alert('Failed to save decision: ' + err.message);
    }
  };

  const cardStyle = {
    background: '#181b24', border: '1px solid #2b303d', borderRadius: '12px',
    padding: '20px', marginBottom: '16px'
  };
  const labelStyle = { color: '#949eb2', fontSize: '12px', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '8px' };
  const inputStyle = {
    background: '#0f1117', border: '1px solid #2b303d', borderRadius: '8px',
    color: '#f0f3f8', padding: '10px 14px', fontSize: '14px', width: '100%', outline: 'none'
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ color: '#f0f3f8', fontSize: '22px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
          <Target size={22} style={{ color: '#2dd4bf' }} /> Procurement Optimizer
        </h2>
        <p style={{ color: '#949eb2', fontSize: '13px', marginTop: '6px' }}>
          Enter a product and quantity — the engine calculates the optimal multi-supplier sourcing strategy.
        </p>
      </div>

      {/* Input Panel */}
      <div style={cardStyle}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 200px 140px', gap: '16px', alignItems: 'end' }}>
          <div>
            <div style={labelStyle}>Product</div>
            <select
              value={selectedProduct?.id || ''}
              onChange={(e) => setSelectedProduct(products.find((p) => p.id === e.target.value) || null)}
              style={{ ...inputStyle, cursor: 'pointer' }}
            >
              <option value="">Select a product…</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.canonical_name}</option>
              ))}
            </select>
          </div>

          <div>
            <div style={labelStyle}>Quantity</div>
            <input
              type="number" min="1" value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
              style={inputStyle}
            />
          </div>

          <div>
            <div style={labelStyle}>Mode</div>
            <div style={{ display: 'flex', gap: '4px' }}>
              {[['best_value', 'Best Value', Zap], ['lowest_cost', 'Lowest Cost', DollarSign]].map(([key, label, Icon]) => (
                <button
                  key={key}
                  onClick={() => setMode(key)}
                  style={{
                    flex: 1, padding: '10px 8px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                    background: mode === key ? '#202430' : 'transparent',
                    border: `1px solid ${mode === key ? '#2dd4bf' : '#2b303d'}`,
                    color: mode === key ? '#2dd4bf' : '#949eb2'
                  }}
                >
                  <Icon size={13} /> {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <button
              onClick={runOptimization}
              disabled={!selectedProduct || loading}
              style={{
                width: '100%', padding: '10px', borderRadius: '8px', border: 'none',
                background: selectedProduct ? 'linear-gradient(135deg, #2dd4bf 0%, #3b82f6 100%)' : '#2b303d',
                color: selectedProduct ? '#0f1117' : '#949eb2',
                fontWeight: 700, fontSize: '13px', cursor: selectedProduct ? 'pointer' : 'not-allowed'
              }}
            >
              {loading ? 'Optimizing…' : 'Optimize'}
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      {result && !result.success && (
        <div style={{ ...cardStyle, borderColor: '#ef4444' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444' }}>
            <AlertCircle size={18} />
            <span style={{ fontWeight: 600 }}>{result.error}</span>
          </div>
          {result.reasoning && (
            <ul style={{ color: '#949eb2', fontSize: '13px', marginTop: '12px', paddingLeft: '20px' }}>
              {result.reasoning.map((r, i) => <li key={i} style={{ marginBottom: '4px' }}>{r}</li>)}
            </ul>
          )}
        </div>
      )}

      {result?.success && (
        <>
          {/* Allocation Table */}
          <div style={cardStyle}>
            <div style={{ ...labelStyle, marginBottom: '14px' }}>Recommended Sourcing Strategy</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #2b303d' }}>
                  {['Supplier', 'Unit Cost', 'Qty', 'Subtotal', 'Score'].map((h) => (
                    <th key={h} style={{ textAlign: h === 'Supplier' ? 'left' : 'right', padding: '10px 12px', color: '#949eb2', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.allocations.map((alloc, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #1a1d27' }}>
                    <td style={{ padding: '12px', color: '#f0f3f8', fontWeight: 600 }}>
                      {alloc.supplier.name}
                      {i === 0 && <span style={{ marginLeft: '8px', fontSize: '10px', padding: '2px 8px', borderRadius: '4px', background: '#2dd4bf20', color: '#2dd4bf', fontWeight: 700 }}>RECOMMENDED</span>}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right', color: '#f0f3f8', fontFamily: "'IBM Plex Mono', monospace" }}>
                      KSh {alloc.unitCost.toLocaleString()}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right', color: '#f0f3f8', fontWeight: 600 }}>
                      {alloc.quantity}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right', color: '#f0f3f8', fontFamily: "'IBM Plex Mono', monospace" }}>
                      KSh {alloc.subtotal.toLocaleString()}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>
                      <span style={{
                        padding: '3px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 700,
                        background: alloc.score >= 85 ? '#2dd4bf20' : alloc.score >= 70 ? '#f59e0b20' : '#ef444420',
                        color: alloc.score >= 85 ? '#2dd4bf' : alloc.score >= 70 ? '#f59e0b' : '#ef4444'
                      }}>
                        {alloc.score}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            {[
              { label: 'Acquisition Cost', value: `KSh ${result.totalCost.toLocaleString()}`, color: '#f0f3f8' },
              { label: result.alternative ? `Alt: ${result.alternative.description}` : 'No Alternative', value: result.alternative ? `KSh ${result.alternative.totalCost.toLocaleString()}` : '—', color: '#949eb2' },
              { label: 'Saving', value: result.saving > 0 ? `KSh ${result.saving.toLocaleString()}` : '—', color: result.saving > 0 ? '#2dd4bf' : '#949eb2' },
              { label: 'Confidence', value: `${result.confidence}%`, color: result.confidence >= 85 ? '#2dd4bf' : '#f59e0b' }
            ].map((card, i) => (
              <div key={i} style={{ ...cardStyle, padding: '16px', marginBottom: 0 }}>
                <div style={{ color: '#949eb2', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', marginBottom: '6px' }}>{card.label}</div>
                <div style={{ color: card.color, fontSize: '18px', fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace" }}>{card.value}</div>
              </div>
            ))}
          </div>

          {/* Why This Recommendation? */}
          <div style={cardStyle}>
            <button
              onClick={() => setShowReasoning(!showReasoning)}
              style={{
                background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, padding: 0
              }}
            >
              <HelpCircle size={15} />
              {result.allocations.length > 1 ? 'Why split this order?' : 'Why this recommendation?'}
              {showReasoning ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {showReasoning && (
              <ul style={{ color: '#d1d5db', fontSize: '13px', marginTop: '12px', paddingLeft: '20px', lineHeight: '1.8' }}>
                {result.reasoning.map((r, i) => (
                  <li key={i} style={{ marginBottom: '2px' }}>{r}</li>
                ))}
              </ul>
            )}
          </div>

          {/* Save Decision */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
            <button
              onClick={saveDecision}
              style={{
                padding: '10px 24px', borderRadius: '8px', border: '1px solid #2dd4bf',
                background: '#2dd4bf15', color: '#2dd4bf', fontWeight: 700, fontSize: '13px',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
              }}
            >
              <CheckCircle size={15} /> Confirm & Save Procurement Decision
            </button>
          </div>
        </>
      )}
    </div>
  );
}
