import { useState, useEffect, useCallback } from 'react';
import { GitMerge, Check, X, ArrowUpDown, Sparkles, ShieldCheck, Tag, Info, AlertTriangle } from 'lucide-react';

export default function MatchReviewQueue({ onUpdate }) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const fetchQueue = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/match-suggestions');
      const data = await res.json();
      setSuggestions(data);
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
    return <div style={{ color: '#949eb2', padding: '24px', textAlign: 'center' }}>Loading AI Match Review Queue...</div>;
  }

  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto', color: '#f0f3f8' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <GitMerge size={22} color="#2dd4bf" /> Match Review Queue ({suggestions.length} pending)
          </h2>
          <p style={{ fontSize: '13px', color: '#949eb2', marginTop: '4px' }}>
            AI proposes potential product matches. Every low-confidence suggestion requires human approval before affecting store pricing.
          </p>
        </div>
        <div style={{ fontSize: '12px', color: '#949eb2', background: '#181b24', border: '1px solid #2b303d', padding: '6px 12px', borderRadius: '8px', fontFamily: "'IBM Plex Mono', monospace" }}>
          Shortcuts: <span style={{ color: '#2dd4bf', fontWeight: 600 }}>[A]</span> Approve · <span style={{ color: '#f43f5e', fontWeight: 600 }}>[R]</span> Reject · <span style={{ color: '#f0f3f8' }}>[↑/↓]</span> Navigate
        </div>
      </div>

      {suggestions.length === 0 ? (
        <div style={{ background: '#181b24', border: '1px solid #2b303d', borderRadius: '12px', padding: '48px 24px', textAlign: 'center' }}>
          <ShieldCheck size={36} color="#2dd4bf" style={{ marginBottom: '12px' }} />
          <div style={{ fontSize: '16px', fontWeight: 600 }}>Review Queue is Clear!</div>
          <div style={{ fontSize: '13px', color: '#949eb2', marginTop: '4px' }}>All AI-suggested product matches have been reviewed and approved.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {suggestions.map((s, idx) => {
            const isSelected = idx === selectedIndex;
            const signals = s.matching_signals || {};
            const confidencePct = Math.round((s.similarity_score || 0) * 100);

            return (
              <div
                key={s.id}
                onClick={() => setSelectedIndex(idx)}
                style={{
                  background: isSelected ? '#202430' : '#181b24',
                  border: `1px solid ${isSelected ? '#2dd4bf' : '#2b303d'}`,
                  borderRadius: '14px',
                  padding: '20px',
                  boxShadow: isSelected ? '0 0 20px rgba(45, 212, 191, 0.15)' : 'none',
                  transition: 'all 0.15s ease',
                  cursor: 'pointer'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ background: confidencePct >= 80 ? 'rgba(45, 212, 191, 0.15)' : 'rgba(245, 158, 11, 0.15)', color: confidencePct >= 80 ? '#2dd4bf' : '#f59e0b', fontSize: '12px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', fontFamily: "'IBM Plex Mono', monospace" }}>
                      {confidencePct}% AI Confidence
                    </span>
                    <span style={{ fontSize: '12px', color: '#949eb2' }}>Suggestion ID: {s.id}</span>
                  </div>

                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleReject(s.id); }}
                      style={{ background: '#202430', border: '1px solid #f43f5e', color: '#f43f5e', padding: '6px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                      <X size={15} /> Reject [R]
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleApprove(s.id); }}
                      style={{ background: '#2dd4bf', border: '1px solid #2dd4bf', color: '#042f2e', padding: '6px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Check size={15} /> Approve Match [A]
                    </button>
                  </div>
                </div>

                {/* Side-by-side Listing Comparison */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 40px 1fr', gap: '12px', alignItems: 'center', marginBottom: '16px' }}>
                  {/* Listing A */}
                  <div style={{ background: '#0f1117', border: '1px solid #2b303d', borderRadius: '10px', padding: '14px' }}>
                    <div style={{ fontSize: '11px', color: '#2dd4bf', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>
                      {s.supplier_a_name || 'Supplier A'} Listing
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>{s.listing_a_name}</div>
                    <div style={{ fontSize: '12px', color: '#949eb2', fontFamily: "'IBM Plex Mono', monospace" }}>
                      SKU: {s.listing_a_sku || 'N/A'} · Price: {s.listing_a_price} {s.listing_a_curr}
                    </div>
                  </div>

                  <div style={{ textAlign: 'center', color: '#949eb2' }}>
                    <ArrowUpDown size={18} />
                  </div>

                  {/* Listing B or Canonical Target */}
                  <div style={{ background: '#0f1117', border: '1px solid #2b303d', borderRadius: '10px', padding: '14px' }}>
                    <div style={{ fontSize: '11px', color: '#3b82f6', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>
                      {s.supplier_b_name ? `${s.supplier_b_name} Listing` : `Existing Canonical: ${s.canonical_name || 'Product'}`}
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>
                      {s.listing_b_name || s.canonical_name || 'Existing Canonical Product'}
                    </div>
                    <div style={{ fontSize: '12px', color: '#949eb2', fontFamily: "'IBM Plex Mono', monospace" }}>
                      SKU: {s.listing_b_sku || 'N/A'} {s.listing_b_price ? `· Price: ${s.listing_b_price} ${s.listing_b_curr}` : ''}
                    </div>
                  </div>
                </div>

                {/* AI Matching Signals Breakdown */}
                <div style={{ background: '#13161f', borderRadius: '8px', padding: '12px', fontSize: '12px' }}>
                  <div style={{ fontSize: '11px', color: '#949eb2', fontWeight: 600, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Sparkles size={13} color="#2dd4bf" /> AI Signal Breakdown & Explanation:
                  </div>
                  <div style={{ color: '#f0f3f8', marginBottom: '8px' }}>{signals.explanation || 'Signal analysis complete.'}</div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {signals.signals && signals.signals.map((sig, sIdx) => (
                      <span key={sIdx} style={{ background: 'rgba(45, 212, 191, 0.1)', color: '#2dd4bf', border: '1px solid rgba(45, 212, 191, 0.2)', padding: '2px 8px', borderRadius: '4px', fontSize: '11px' }}>
                        ✓ {sig}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
