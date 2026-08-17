import { useState } from 'react';
import { X, Award, ShieldCheck, DollarSign, TrendingUp, Scissors, GitMerge, Layers, Clock } from 'lucide-react';

export default function ProductDetailModal({ product, onClose, onSplit, onUpdate }) {
  const [targetSellPrice, setTargetSellPrice] = useState(
    product.recommendedOffer ? Math.round(product.recommendedOffer.price_in_base_currency * 1.25) : 0
  );

  if (!product) return null;

  const recOffer = product.recommendedOffer;

  const handleSplitItem = async (rawListingId) => {
    if (confirm('Split this raw listing out into its own standalone product?')) {
      try {
        await fetch('/api/products/split', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rawListingId })
        });
        if (onUpdate) onUpdate();
        onClose();
      } catch (err) {
        console.error(err);
      }
    }
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: '#181b24', border: '1px solid #2b303d', borderRadius: '16px', maxWidth: '900px', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '24px', color: '#f0f3f8', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div>
            <div style={{ fontSize: '12px', color: '#2dd4bf', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>
              Canonical Product Detail
            </div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '4px 0 0 0' }}>{product.canonical_name}</h2>
            <div style={{ fontSize: '13px', color: '#949eb2', marginTop: '2px' }}>
              Brand: <strong>{product.brand || 'Generic'}</strong> · Category: <strong>{product.category || 'Electronics'}</strong> · Model: <strong>{product.model_number || 'N/A'}</strong>
            </div>
          </div>
          <button onClick={onClose} style={{ background: '#202430', border: '1px solid #2b303d', color: '#f0f3f8', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer' }}>
            <X size={16} />
          </button>
        </div>

        {/* Recommended Sourcing Supplier Highlight */}
        {recOffer && (
          <div style={{ background: 'linear-gradient(135deg, rgba(45, 212, 191, 0.1) 0%, rgba(59, 130, 246, 0.1) 100%)', border: '1px solid #2dd4bf', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#2dd4bf', fontWeight: 700 }}>
                  <Award size={16} /> RECOMMENDED SOURCING SUPPLIER
                </div>
                <div style={{ fontSize: '16px', fontWeight: 700, marginTop: '2px' }}>{recOffer.supplier_name}</div>
                <div style={{ fontSize: '12px', color: '#949eb2', marginTop: '2px' }}>
                  Reliability: <strong>{recOffer.supplier.reliability_score}/10</strong> · Lead Time: <strong>{recOffer.supplier.avg_delivery_days} days</strong> · Warranty: <strong>{recOffer.supplier.warranty_terms_default}</strong>
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#2dd4bf', fontFamily: "'IBM Plex Mono', monospace" }}>
                  {recOffer.price_in_base_currency.toLocaleString(undefined, { minimumFractionDigits: 2 })} KES
                </div>
                <div style={{ fontSize: '11px', color: '#949eb2' }}>
                  ({recOffer.price} {recOffer.currency}) · Overall Score: <strong style={{ color: '#2dd4bf' }}>{recOffer.scoreInfo?.totalScore || 'N/A'}</strong>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Margin Calculator */}
        <div style={{ background: '#202430', border: '1px solid #2b303d', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#f0f3f8', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <DollarSign size={16} color="#2dd4bf" /> Interactive Margin Calculator (KES Base Currency)
          </div>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <label style={{ fontSize: '11px', color: '#949eb2', display: 'block', marginBottom: '4px' }}>Target Resell Price (KES)</label>
              <input
                type="number"
                value={targetSellPrice}
                onChange={(e) => setTargetSellPrice(parseFloat(e.target.value) || 0)}
                style={{ background: '#0f1117', border: '1px solid #2b303d', borderRadius: '8px', color: '#2dd4bf', padding: '8px 12px', fontSize: '14px', fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace", width: '180px', outline: 'none' }}
              />
            </div>

            {recOffer && (
              <div style={{ flex: 1, display: 'flex', gap: '20px', background: '#0f1117', padding: '10px 16px', borderRadius: '8px', border: '1px solid #2b303d' }}>
                <div>
                  <div style={{ fontSize: '10px', color: '#949eb2', textTransform: 'uppercase' }}>Recommended Cost</div>
                  <div style={{ fontSize: '14px', fontWeight: 600, fontFamily: "'IBM Plex Mono', monospace" }}>{recOffer.price_in_base_currency.toFixed(2)} KES</div>
                </div>
                <div>
                  <div style={{ fontSize: '10px', color: '#949eb2', textTransform: 'uppercase' }}>Gross Profit</div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#2dd4bf', fontFamily: "'IBM Plex Mono', monospace" }}>
                    {(targetSellPrice - recOffer.price_in_base_currency).toFixed(2)} KES
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '10px', color: '#949eb2', textTransform: 'uppercase' }}>Profit Margin</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: (targetSellPrice - recOffer.price_in_base_currency) > 0 ? '#3ddc97' : '#f43f5e', fontFamily: "'IBM Plex Mono', monospace" }}>
                    {targetSellPrice > 0 ? (((targetSellPrice - recOffer.price_in_base_currency) / targetSellPrice) * 100).toFixed(1) : 0}%
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* All Supplier Offers Grid */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '10px' }}>All Supplier Offers ({product.offers.length})</div>
          <div style={{ background: '#0f1117', border: '1px solid #2b303d', borderRadius: '10px', overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr 1fr 1fr 40px', gap: '10px', padding: '10px 14px', fontSize: '11px', color: '#949eb2', textTransform: 'uppercase', borderBottom: '1px solid #2b303d' }}>
              <div>Supplier</div><div>Quoted Price</div><div>Base Price (KES)</div><div>Availability</div><div>Action</div>
            </div>
            {product.offers.map((off) => {
              const isRec = recOffer && recOffer.raw_listing_id === off.raw_listing_id;
              return (
                <div key={off.id} style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr 1fr 1fr 40px', gap: '10px', padding: '10px 14px', alignItems: 'center', fontSize: '13px', borderBottom: '1px solid #181b24', background: isRec ? 'rgba(45, 212, 191, 0.05)' : 'transparent' }}>
                  <div>
                    <div style={{ fontWeight: 500 }}>{off.supplier_name}</div>
                    <div style={{ fontSize: '11px', color: '#949eb2' }}>{off.raw_name}</div>
                  </div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{off.price} {off.currency}</div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: isRec ? 700 : 400, color: isRec ? '#2dd4bf' : '#f0f3f8' }}>
                    {off.price_in_base_currency.toLocaleString(undefined, { minimumFractionDigits: 2 })} KES
                  </div>
                  <div>
                    <span style={{ color: off.stock_status === 'in_stock' ? '#3ddc97' : '#f43f5e', fontSize: '12px' }}>
                      ● {off.stock_status === 'in_stock' ? `${off.stock_qty || 'In'} Stock` : 'Out of Stock'}
                    </span>
                  </div>
                  <div>
                    {product.offers.length > 1 && (
                      <button title="Split listing out of product" onClick={() => handleSplitItem(off.raw_listing_id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#949eb2' }}>
                        <Scissors size={14} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
