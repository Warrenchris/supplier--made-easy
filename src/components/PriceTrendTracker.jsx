import { useState, useEffect, useMemo } from 'react';
import { 
  TrendingUp, TrendingDown, Minus, BarChart3, 
  RefreshCw, Filter, Search, ShieldCheck, 
  ChevronRight, Calendar, ArrowUpDown
} from 'lucide-react';

export default function PriceTrendTracker() {
  const [products, setProducts] = useState([]);
  const [trends, setTrends] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [movementFilter, setMovementFilter] = useState('ALL'); // ALL, DROPS, INCREASES, STABLE
  const [selectedProduct, setSelectedProduct] = useState(null);

  const fetchTrendsData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/canonical-products');
      const data = await res.json();
      const prods = Array.isArray(data) ? data : [];
      setProducts(prods);

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
    } catch (err) {
      console.error('Failed to load price trends:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrendsData();
  }, []);

  const filteredProducts = useMemo(() => {
    const q = search.toLowerCase().trim();
    return products.filter((p) => {
      const pTrends = trends[p.id] || [];
      const primary = pTrends[0];
      const dir7 = primary?.trend7d?.direction;
      const dir30 = primary?.trend30d?.direction;

      if (movementFilter === 'DROPS' && dir7 !== 'down' && dir30 !== 'down') return false;
      if (movementFilter === 'INCREASES' && dir7 !== 'up' && dir30 !== 'up') return false;
      if (movementFilter === 'STABLE' && dir7 !== 'stable' && dir30 !== 'stable') return false;

      if (!q) return true;
      return (p.canonical_name || '').toLowerCase().includes(q) || (p.brand || '').toLowerCase().includes(q);
    });
  }, [products, trends, search, movementFilter]);

  const Sparkline = ({ data }) => {
    if (!data || data.length < 2) return <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>—</span>;

    const prices = data.map((d) => d.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 1;
    const width = 120;
    const height = 24;

    const points = data.map((d, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((d.price - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    }).join(' ');

    const lastPrice = prices[prices.length - 1];
    const firstPrice = prices[0];
    const color = lastPrice <= firstPrice ? 'var(--forest-bright)' : 'var(--color-warning-text)';

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
        <circle cx={parseFloat(points.split(' ').pop().split(',')[0])} cy={parseFloat(points.split(' ').pop().split(',')[1])} r="2" fill={color} />
      </svg>
    );
  };

  const TrendBadge = ({ trend }) => {
    if (!trend || trend.change === null || trend.confidence === 'insufficient') {
      return <span className="badge badge-neutral">Insufficient data</span>;
    }

    if (trend.direction === 'down') {
      return (
        <span className="badge badge-success font-mono">
          <TrendingDown size={11} /> {trend.change}%
        </span>
      );
    }
    if (trend.direction === 'up') {
      return (
        <span className="badge badge-warning font-mono">
          <TrendingUp size={11} /> +{trend.change}%
        </span>
      );
    }
    return (
      <span className="badge badge-neutral font-mono">
        <Minus size={11} /> 0.0%
      </span>
    );
  };

  const ConfidenceBadge = ({ confidence, count }) => {
    const badges = {
      high: 'badge-forest',
      medium: 'badge-warning',
      low: 'badge-neutral',
      insufficient: 'badge-neutral'
    };
    return (
      <span className={`badge ${badges[confidence] || 'badge-neutral'}`} style={{ fontSize: '10px' }}>
        {confidence === 'insufficient' ? '0 obs' : `${count} obs · ${confidence}`}
      </span>
    );
  };

  if (loading) {
    return (
      <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
        <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite', marginBottom: '8px' }} />
        <div>Loading Market Price Intelligence...</div>
      </div>
    );
  }

  return (
    <div className="animate-fade" style={{ maxWidth: '1280px', margin: '0 auto' }}>
      
      {/* ─── Header ─── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--forest-text)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
            Market Intelligence
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Price Intelligence & Trend Terminal
          </h1>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Monitor historical supplier pricing shifts, price drop arbitrage signals, and confidence-weighted trends.
          </p>
        </div>

        <button onClick={fetchTrendsData} className="btn-secondary" style={{ fontSize: '12px' }}>
          <RefreshCw size={14} /> Refresh Terminal
        </button>
      </div>

      {/* ─── Filter Bar ─── */}
      <div className="panel" style={{ padding: '12px 16px', marginBottom: '16px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
          <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search price movements by product or brand..."
            style={{ width: '100%', paddingLeft: '32px', fontSize: '12px' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '4px' }}>
          {[
            ['ALL', 'All Movements'],
            ['DROPS', '🟢 Price Drops'],
            ['INCREASES', '🔴 Increases'],
            ['STABLE', '⚪ Stable']
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setMovementFilter(key)}
              style={{
                fontSize: '11px',
                padding: '5px 10px',
                borderRadius: 'var(--radius-xs)',
                backgroundColor: movementFilter === key ? 'var(--forest-primary)' : 'var(--bg-elevated)',
                color: movementFilter === key ? '#F7F5EF' : 'var(--text-muted)',
                border: `1px solid ${movementFilter === key ? 'var(--forest-hover)' : 'var(--border-subtle)'}`
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Price Intelligence Matrix ─── */}
      <div className="panel" style={{ overflow: 'hidden' }}>
        <table className="enterprise-table">
          <thead>
            <tr>
              <th>Canonical Product</th>
              <th style={{ textAlign: 'right' }}>Current Price</th>
              <th style={{ textAlign: 'center' }}>7D Movement</th>
              <th style={{ textAlign: 'center' }}>30D Movement</th>
              <th style={{ textAlign: 'center' }}>Confidence</th>
              <th style={{ textAlign: 'center' }}>30-Day Curve</th>
              <th style={{ textAlign: 'left' }}>Market Signal</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)' }}>
                  No historical price observations match this filter.
                </td>
              </tr>
            ) : (
              filteredProducts.map((p) => {
                const pTrends = trends[p.id] || [];
                const primary = pTrends[0];
                const trend7d = primary?.trend7d;
                const trend30d = primary?.trend30d;
                const alert = primary?.alert;
                const spark = primary?.sparklineData;
                const currentPrice = primary?.currentPrice || (p.recommendedOffer?.cost_in_base_currency || p.recommendedOffer?.price_in_base_currency);

                return (
                  <tr key={p.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {p.canonical_name}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {p.brand || 'Generic'} · {p.category || 'Electronics'}
                      </div>
                    </td>

                    <td style={{ textAlign: 'right' }}>
                      {currentPrice ? (
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                          KSh {Math.round(currentPrice).toLocaleString()}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>

                    <td style={{ textAlign: 'center' }}>
                      <TrendBadge trend={trend7d} />
                    </td>

                    <td style={{ textAlign: 'center' }}>
                      <TrendBadge trend={trend30d} />
                    </td>

                    <td style={{ textAlign: 'center' }}>
                      <ConfidenceBadge 
                        confidence={trend7d?.confidence || trend30d?.confidence || 'insufficient'}
                        count={(trend7d?.observationCount || 0) + (trend30d?.observationCount || 0)}
                      />
                    </td>

                    <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                      <div style={{ display: 'inline-block' }}>
                        <Sparkline data={spark} />
                      </div>
                    </td>

                    <td>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        {alert ? alert.message : (trend7d?.message || 'Price stable')}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}
