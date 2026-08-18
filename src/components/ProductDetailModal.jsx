import { useState } from 'react';
import { 
  X, Award, ShieldCheck, DollarSign, TrendingUp, 
  Scissors, GitMerge, Layers, Clock, CheckCircle2, 
  Building2, Tag, Percent
} from 'lucide-react';
import api from '../services/apiClient';
import { useToast } from '../context/ToastContext';

export default function ProductDetailModal({ product, onClose, onUpdate }) {
  const toast = useToast();
  const recOffer = product?.recommendedOffer;
  const initialCost = recOffer ? (recOffer.cost_in_base_currency || recOffer.price_in_base_currency || 0) : 0;
  const [targetSellPrice, setTargetSellPrice] = useState(
    initialCost > 0 ? Math.round(initialCost * 1.30) : 0
  );

  if (!product) return null;

  const handleSplitItem = async (rawListingId) => {
    if (confirm('Split this raw listing out into its own standalone canonical product?')) {
      try {
        const res = await api.post('/api/products/split', { rawListingId });
        toast.success(`Listing split into new standalone product: ${res.newProduct?.canonical_name || 'Created'}`, 'Product Split Successfully');
        if (onUpdate) onUpdate();
        onClose();
      } catch (err) {
        toast.error(err.message, 'Failed to Split Product');
      }
    }
  };

  const grossProfit = targetSellPrice - initialCost;
  const grossMarginPct = targetSellPrice > 0 ? ((grossProfit / targetSellPrice) * 100) : 0;

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div 
        className="panel animate-fade" 
        style={{ 
          maxWidth: '900px', 
          width: '100%', 
          maxHeight: '90vh', 
          overflowY: 'auto', 
          padding: '24px', 
          backgroundColor: 'var(--bg-surface)',
          boxShadow: '0 20px 50px rgba(0,0,0,0.6)'
        }}
      >
        
        {/* ─── Modal Header ─── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--forest-text)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Canonical Product Specifications
            </div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', margin: '2px 0 0 0' }}>
              {product.canonical_name}
            </h2>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span>Brand: <strong style={{ color: 'var(--text-secondary)' }}>{product.brand || 'Generic'}</strong></span>
              <span>·</span>
              <span>Category: <strong style={{ color: 'var(--text-secondary)' }}>{product.category || 'Electronics'}</strong></span>
              {product.model_number && (
                <>
                  <span>·</span>
                  <span>Model: <strong style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{product.model_number}</strong></span>
                </>
              )}
            </div>
          </div>

          <button onClick={onClose} className="btn-ghost" style={{ padding: '6px' }}>
            <X size={18} />
          </button>
        </div>

        {/* ─── Recommended Supplier Highlight ─── */}
        {recOffer && (
          <div 
            className="panel" 
            style={{ 
              padding: '16px 20px', 
              marginBottom: '20px', 
              backgroundColor: 'var(--forest-light)', 
              borderColor: 'var(--forest-border)' 
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700, color: 'var(--forest-bright)', textTransform: 'uppercase' }}>
                  <Award size={14} /> Recommended Sourcing Supplier
                </div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                  {recOffer.supplier_name}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Lead Time: {recOffer.supplier?.avg_delivery_days ? `${recOffer.supplier.avg_delivery_days} days` : '3 days'} · Warranty: {recOffer.warranty_terms || recOffer.supplier?.warranty_terms_default || '1 Year'}
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                  KSh {Math.round(initialCost).toLocaleString()}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--forest-bright)', fontFamily: 'var(--font-mono)' }}>
                  Overall Score: {recOffer.scoreInfo?.totalScore || 'N/A'}/100
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── Interactive Margin Calculator ─── */}
        <div className="panel" style={{ padding: '16px 20px', marginBottom: '20px', backgroundColor: 'var(--bg-elevated)' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
            <DollarSign size={14} color="var(--copper-text)" /> Commercial Resale & Margin Simulator (KES Base)
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr 1fr 1fr', gap: '16px', alignItems: 'center' }}>
            <div>
              <label style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                Target Retail (KES)
              </label>
              <input
                type="number"
                value={targetSellPrice}
                onChange={(e) => setTargetSellPrice(parseFloat(e.target.value) || 0)}
                className="font-mono"
                style={{ width: '100%', fontWeight: 700, color: 'var(--copper-text)' }}
              />
            </div>

            <div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Acquisition Cost</div>
              <div style={{ fontSize: '14px', fontWeight: 600, fontFamily: 'var(--font-mono)', marginTop: '4px' }}>
                KSh {Math.round(initialCost).toLocaleString()}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Unit Gross Profit</div>
              <div style={{ fontSize: '14px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: grossProfit >= 0 ? 'var(--forest-bright)' : 'var(--color-danger-text)', marginTop: '4px' }}>
                KSh {Math.round(grossProfit).toLocaleString()}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Gross Margin</div>
              <div style={{ fontSize: '14px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: grossMarginPct >= 20 ? 'var(--forest-bright)' : 'var(--color-warning-text)', marginTop: '4px' }}>
                {grossMarginPct.toFixed(1)}%
              </div>
            </div>
          </div>
        </div>

        {/* ─── All Supplier Offers Matrix ─── */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
            Active Supplier Offers ({product.offers?.length || 0})
          </div>

          <div className="panel" style={{ overflow: 'hidden' }}>
            <table className="enterprise-table" style={{ fontSize: '12px' }}>
              <thead>
                <tr>
                  <th>Supplier</th>
                  <th>Raw Listing / SKU</th>
                  <th style={{ textAlign: 'right' }}>Quoted</th>
                  <th style={{ textAlign: 'right' }}>Base (KES)</th>
                  <th style={{ textAlign: 'center' }}>Stock</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {(product.offers || []).map((off) => {
                  const isRec = recOffer && recOffer.id === off.id;
                  const baseCost = Math.round(off.cost_in_base_currency || off.price_in_base_currency || 0);

                  return (
                    <tr key={off.id} style={{ backgroundColor: isRec ? 'var(--forest-light)' : 'transparent' }}>
                      <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {off.supplier_name}
                        {isRec && <span className="badge badge-forest" style={{ marginLeft: '6px', fontSize: '9px' }}>Recommended</span>}
                      </td>
                      <td style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                        {off.supplier_sku || off.sku || '—'}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                        {off.cost || off.price} {off.currency}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                        KSh {baseCost.toLocaleString()}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`badge ${off.stock_status === 'in_stock' ? 'badge-success' : 'badge-danger'}`}>
                          {off.quantity_available || off.stock_qty || 0} units
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {product.offers.length > 1 && (
                          <button
                            onClick={() => handleSplitItem(off.raw_listing_id || off.id)}
                            className="btn-ghost"
                            style={{ padding: '3px 6px', fontSize: '10px', color: 'var(--text-muted)' }}
                            title="Split this listing into a separate canonical product"
                          >
                            <Scissors size={12} /> Split
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Close Action */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="btn-secondary" style={{ fontSize: '12px' }}>
            Close Inspector
          </button>
        </div>

      </div>
    </div>
  );
}
