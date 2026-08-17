import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Minus, AlertTriangle, BarChart3, RefreshCw } from 'lucide-react';

export default function PriceTrendTracker() {
  const [products, setProducts] = useState([]);
  const [trends, setTrends] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/canonical-products');
      const data = await res.json();
      const prods = Array.isArray(data) ? data : [];
      setProducts(prods);

      // Fetch trends for all products
      const trendMap = {};
      for (const p of prods) {
        try {
          const tRes = await fetch(`/api/price-trends?productId=${p.id}`);
          const tData = await tRes.json();
          trendMap[p.id] = Array.isArray(tData) ? tData : [tData];
        } catch {
          trendMap[p.id] = [];
        }
      }
      setTrends(trendMap);
    } catch {
      setProducts([]);
    }
    setLoading(false);
  };

  const cardStyle = {
    background: '#181b24', border: '1px solid #2b303d', borderRadius: '12px',
    padding: '16px', cursor: 'pointer', transition: 'border-color 0.15s ease'
  };

  const TrendPill = ({ trend }) => {
    if (!trend || trend.change === null || trend.confidence === 'insufficient') {
      return (
        <span style={{ padding: '3px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, background: '#2b303d', color: '#949eb2' }}>
          Insufficient data
        </span>
      );
    }

    const isDown = trend.direction === 'down';
    const isUp = trend.direction === 'up';
    const isStable = trend.direction === 'stable';
    const color = isDown ? '#2dd4bf' : isUp ? '#ef4444' : '#949eb2';
    const bg = isDown ? '#2dd4bf15' : isUp ? '#ef444415' : '#2b303d';
    const icon = isDown ? '🟢' : isUp ? '🔴' : '⚪';

    return (
      <span style={{ padding: '3px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, background: bg, color, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
        {icon} {isStable ? 'Stable' : `${trend.change > 0 ? '+' : ''}${trend.change}%`}
      </span>
    );
  };

  const ConfidenceBadge = ({ confidence, count }) => {
    const colors = {
      high: { bg: '#2dd4bf15', color: '#2dd4bf' },
      medium: { bg: '#f59e0b15', color: '#f59e0b' },
      low: { bg: '#ef444415', color: '#ef4444' },
      insufficient: { bg: '#2b303d', color: '#949eb2' }
    };
    const c = colors[confidence] || colors.insufficient;

    return (
      <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 600, background: c.bg, color: c.color }}>
        {confidence === 'insufficient' ? 'No data' : `${count} obs · ${confidence}`}
      </span>
    );
  };

  const Sparkline = ({ data }) => {
    if (!data || data.length < 2) return <span style={{ color: '#949eb2', fontSize: '11px' }}>—</span>;

    const prices = data.map((d) => d.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 1;
    const width = 140;
    const height = 32;

    const points = data.map((d, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((d.price - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    }).join(' ');

    const lastPrice = prices[prices.length - 1];
    const firstPrice = prices[0];
    const color = lastPrice <= firstPrice ? '#2dd4bf' : '#ef4444';

    return (
      <svg width={width} height={height} style={{ display: 'block' }}>
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <circle cx={parseFloat(points.split(' ').pop().split(',')[0])} cy={parseFloat(points.split(' ').pop().split(',')[1])} r="2.5" fill={color} />
      </svg>
    );
  };

  if (loading) {
    return (
      <div style={{ color: '#949eb2', textAlign: 'center', padding: '60px 0' }}>
        <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite' }} />
        <div style={{ marginTop: '12px' }}>Loading price trends…</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ color: '#f0f3f8', fontSize: '22px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
          <BarChart3 size={22} style={{ color: '#3b82f6' }} /> Price Trend Tracker
        </h2>
        <p style={{ color: '#949eb2', fontSize: '13px', marginTop: '6px' }}>
          Historical price analysis with confidence-qualified 7-day and 30-day trend indicators.
        </p>
      </div>

      {/* Product Trend Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {products.map((product) => {
          const productTrends = trends[product.id] || [];
          const isSelected = selectedProduct?.id === product.id;

          // Get the primary trend (first supplier or aggregated)
          const primaryTrend = productTrends[0];
          const trend7d = primaryTrend?.trend7d;
          const trend30d = primaryTrend?.trend30d;
          const alert = primaryTrend?.alert;

          return (
            <div
              key={product.id}
              onClick={() => setSelectedProduct(isSelected ? null : product)}
              style={{ ...cardStyle, borderColor: isSelected ? '#3b82f6' : '#2b303d' }}
            >
              {/* Product Header Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 100px 150px 100px', gap: '16px', alignItems: 'center' }}>
                <div>
                  <div style={{ color: '#f0f3f8', fontWeight: 600, fontSize: '14px' }}>{product.canonical_name}</div>
                  <div style={{ color: '#949eb2', fontSize: '11px', marginTop: '2px' }}>
                    {product.brand || 'Generic'} · {product.category || 'Electronics'}
                    {product.offers?.length > 0 && ` · ${product.offers.length} supplier${product.offers.length > 1 ? 's' : ''}`}
                  </div>
                </div>

                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: '#949eb2', fontSize: '10px', fontWeight: 600, marginBottom: '4px' }}>7-DAY</div>
                  <TrendPill trend={trend7d} />
                </div>

                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: '#949eb2', fontSize: '10px', fontWeight: 600, marginBottom: '4px' }}>30-DAY</div>
                  <TrendPill trend={trend30d} />
                </div>

                <div style={{ textAlign: 'center' }}>
                  <Sparkline data={primaryTrend?.sparklineData} />
                </div>

                <div style={{ textAlign: 'right' }}>
                  {primaryTrend?.currentPrice && (
                    <div style={{ color: '#f0f3f8', fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace", fontSize: '14px' }}>
                      KSh {Math.round(primaryTrend.currentPrice).toLocaleString()}
                    </div>
                  )}
                </div>
              </div>

              {/* Alert */}
              {alert && alert.type !== 'stable' && (
                <div style={{
                  marginTop: '10px', padding: '8px 12px', borderRadius: '8px',
                  background: alert.severity === 'positive' ? '#2dd4bf08' : '#ef444408',
                  border: `1px solid ${alert.severity === 'positive' ? '#2dd4bf20' : '#ef444420'}`,
                  color: alert.severity === 'positive' ? '#2dd4bf' : '#ef4444',
                  fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px'
                }}>
                  {alert.icon} {alert.message}
                  <span style={{ color: '#949eb2', marginLeft: 'auto', fontSize: '11px' }}>{alert.detail}</span>
                </div>
              )}

              {/* Expanded: Per-Supplier Trends */}
              {isSelected && productTrends.length > 0 && (
                <div style={{ marginTop: '16px', borderTop: '1px solid #2b303d', paddingTop: '14px' }}>
                  <div style={{ color: '#949eb2', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', marginBottom: '10px' }}>Per-Supplier Breakdown</div>
                  {productTrends.map((t, i) => {
                    const supplier = product.offers?.find((o) => o.supplier_id === t.supplierId)?.supplier;
                    return (
                      <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 100px 120px', gap: '12px', alignItems: 'center', padding: '8px 0', borderBottom: i < productTrends.length - 1 ? '1px solid #1a1d27' : 'none' }}>
                        <div style={{ color: '#d1d5db', fontSize: '13px' }}>
                          {supplier?.name || t.supplierId || `Supplier ${i + 1}`}
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <TrendPill trend={t.trend7d} />
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <TrendPill trend={t.trend30d} />
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <ConfidenceBadge confidence={t.trend30d?.confidence} count={t.trend30d?.observationCount} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
