import { useState, useEffect, useCallback } from 'react';
import { 
  GitMerge, Check, X, ArrowUpDown, ShieldCheck, 
  Tag, Info, AlertTriangle, CheckCircle2, RefreshCw, 
  ArrowRight, Layers, Sparkles
} from 'lucide-react';

export default function MatchReviewQueue({ onUpdate }) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const fetchQueue = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/match-suggestions');
      const data = await res.json();
      setSuggestions(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch match queue:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, []);

  const handleApprove = async (id) => {
    try {
      await fetch(`/api/match-suggestions/${id}/approve`, { method: 'POST' });
      setSuggestions((prev) => prev.filter((s) => s.id !== id));
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error(err);
    }
  };

  const handleReject = async (id) => {
    try {
      await fetch(`/api/match-suggestions/${id}/reject`, { method: 'POST' });
      setSuggestions((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  // Keyboard Navigation: [A] Approve, [R] Reject, [ArrowDown] Next, [ArrowUp] Prev
  const handleKeyDown = useCallback(
    (e) => {
      if (!suggestions.length) return;
      const current = suggestions[selectedIndex];
      if (e.key === 'a' || e.key === 'A') {
        if (current) handleApprove(current.id);
      } else if (e.key === 'r' || e.key === 'R') {
        if (current) handleReject(current.id);
      } else if (e.key === 'ArrowDown') {
        setSelectedIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
      } else if (e.key === 'ArrowUp') {
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      }
    },
    [suggestions, selectedIndex]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (loading) {
    return (
      <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
        <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite', marginBottom: '8px' }} />
        <div>Loading AI Match Reconciliation Queue...</div>
      </div>
    );
  }

  return (
    <div className="animate-fade" style={{ maxWidth: '1100px', margin: '0 auto' }}>
      
      {/* ─── Header ─── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--forest-text)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
            Data Quality & Entity Resolution
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Product Match Review Queue ({suggestions.length} pending)
          </h1>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Human-in-the-loop review for ambiguous supplier pricelist listings before unifying canonical products.
          </p>
        </div>

        <div style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', padding: '6px 12px', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-mono)' }}>
          Shortcuts: <span style={{ color: 'var(--forest-bright)', fontWeight: 600 }}>[A]</span> Approve · <span style={{ color: 'var(--color-danger-text)', fontWeight: 600 }}>[R]</span> Reject · <span style={{ color: 'var(--text-primary)' }}>[↑/↓]</span> Navigate
        </div>
      </div>

      {suggestions.length === 0 ? (
        <div className="panel" style={{ padding: '48px 24px', textAlign: 'center' }}>
          <ShieldCheck size={36} color="var(--forest-bright)" style={{ marginBottom: '12px' }} />
          <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>Review Queue is Clear</div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px', maxWidth: '400px', margin: '4px auto 0' }}>
            All incoming raw supplier catalog listings have been confirmed and mapped to the canonical product registry.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {suggestions.map((s, idx) => {
            const isSelected = idx === selectedIndex;
            const signals = s.matching_signals || {};
            const confidencePct = Math.round((s.similarity_score || 0) * 100);

            return (
              <div
                key={s.id}
                onClick={() => setSelectedIndex(idx)}
                className="panel"
                style={{
                  padding: '18px 20px',
                  borderColor: isSelected ? 'var(--forest-primary)' : 'var(--border-default)',
                  backgroundColor: isSelected ? 'var(--bg-elevated)' : 'var(--bg-surface)',
                  cursor: 'pointer',
                  boxShadow: isSelected ? '0 0 0 1px var(--forest-primary)' : 'none'
                }}
              >
                {/* Top Meta Bar */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className={`badge ${confidencePct >= 80 ? 'badge-forest' : 'badge-warning'} font-mono`}>
                      {confidencePct}% AI Match Confidence
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      ID: {s.id}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleReject(s.id); }}
                      className="btn-secondary"
                      style={{ fontSize: '11px', color: 'var(--color-danger-text)', borderColor: 'rgba(185, 74, 72, 0.4)' }}
                    >
                      <X size={13} /> Reject [R]
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleApprove(s.id); }}
                      className="btn-primary"
                      style={{ fontSize: '11px' }}
                    >
                      <Check size={13} /> Approve Match [A]
                    </button>
                  </div>
                </div>

                {/* Side-by-Side Comparison */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 30px 1fr', gap: '12px', alignItems: 'center', marginBottom: '14px' }}>
                  
                  {/* Incoming Listing */}
                  <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '12px 14px' }}>
                    <div style={{ fontSize: '10px', color: 'var(--forest-bright)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>
                      Incoming Supplier Listing ({s.supplier_a_name || 'Supplier'})
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                      {s.listing_a_name}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      SKU: {s.listing_a_sku || 'N/A'} · Quoted: {s.listing_a_price} {s.listing_a_curr}
                    </div>
                  </div>

                  <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                    <ArrowRight size={16} />
                  </div>

                  {/* Canonical Target Product */}
                  <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '12px 14px' }}>
                    <div style={{ fontSize: '10px', color: 'var(--copper-text)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>
                      Canonical Target Product
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                      {s.canonical_name || (s.listing_b_name || 'New Canonical Product')}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {s.listing_b_sku ? `SKU: ${s.listing_b_sku}` : 'Verified Catalog Entry'}
                    </div>
                  </div>

                </div>

                {/* Matching Signals Breakdown */}
                {Object.keys(signals).length > 0 && (
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Signals:</span>
                    {Object.entries(signals).map(([key, val]) => (
                      <span key={key} className="badge badge-neutral" style={{ fontSize: '10px' }}>
                        ✓ {key}: {String(val)}
                      </span>
                    ))}
                  </div>
                )}

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
