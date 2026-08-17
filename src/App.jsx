import { useState } from 'react';
import ComparisonBoard from './components/ComparisonBoard';
import MatchReviewQueue from './components/MatchReviewQueue';
import ImportHub from './components/ImportHub';
import SupplierManager from './components/SupplierManager';
import AdminSettings from './components/AdminSettings';
import ProcurementOptimizer from './components/ProcurementOptimizer';
import PriceTrendTracker from './components/PriceTrendTracker';
import StorefrontSync from './components/StorefrontSync';
import { Package, Layers, GitMerge, Upload, Store, Sliders, Target, TrendingUp, ShoppingCart, Github } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('optimizer');

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#0f1117' }}>
      
      {/* Primary Header Bar */}
      <header style={{ borderBottom: '1px solid #2b303d', background: '#181b24', padding: '14px 28px' }}>
        <div style={{ maxWidth: '1340px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: 'linear-gradient(135deg, #2dd4bf 0%, #3b82f6 100%)', borderRadius: '10px', padding: '8px', display: 'flex', color: '#0f1117' }}>
              <Package size={22} strokeWidth={2.5} />
            </div>
            <div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#f0f3f8', letterSpacing: '-0.01em' }}>
                Supplier Made Easy
              </div>
              <div style={{ fontSize: '11px', color: '#949eb2', fontFamily: "'IBM Plex Mono', monospace" }}>
                Procurement Intelligence Engine v3.0
              </div>
            </div>
          </div>

          {/* Operational Hub Navigation Tabs */}
          <nav style={{ display: 'flex', gap: '4px', background: '#0f1117', border: '1px solid #2b303d', padding: '4px', borderRadius: '10px', flexWrap: 'wrap' }}>
            {[
              ['optimizer', 'Procurement', Target],
              ['trends', 'Price Trends', TrendingUp],
              ['board', 'Comparison', Layers],
              ['queue', 'Match Queue', GitMerge],
              ['import', 'Import', Upload],
              ['suppliers', 'Suppliers', Store],
              ['storefront', 'Storefront', ShoppingCart],
              ['admin', 'Admin', Sliders]
            ].map(([tabKey, label, Icon]) => {
              const isActive = activeTab === tabKey;
              return (
                <button
                  key={tabKey}
                  onClick={() => setActiveTab(tabKey)}
                  style={{
                    background: isActive ? '#202430' : 'transparent',
                    border: `1px solid ${isActive ? '#2dd4bf' : 'transparent'}`,
                    color: isActive ? '#2dd4bf' : '#949eb2',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: isActive ? 600 : 400,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Icon size={14} /> {label}
                </button>
              );
            })}
          </nav>

          <div>
            <a
              href="https://github.com/Warrenchris/supplier--made-easy"
              target="_blank"
              rel="noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#949eb2', textDecoration: 'none', fontSize: '13px' }}
            >
              <Github size={16} /> GitHub
            </a>
          </div>

        </div>
      </header>

      {/* Main Operational View */}
      <main style={{ flex: 1, padding: '24px 16px' }}>
        {activeTab === 'optimizer' && <ProcurementOptimizer />}
        {activeTab === 'trends' && <PriceTrendTracker />}
        {activeTab === 'board' && <ComparisonBoard />}
        {activeTab === 'queue' && <MatchReviewQueue onUpdate={() => {}} />}
        {activeTab === 'import' && <ImportHub onImportSuccess={() => setActiveTab('board')} />}
        {activeTab === 'suppliers' && <SupplierManager />}
        {activeTab === 'storefront' && <StorefrontSync />}
        {activeTab === 'admin' && <AdminSettings />}
      </main>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid #2b303d', padding: '16px 28px', background: '#181b24', color: '#949eb2', fontSize: '12px' }}>
        <div style={{ maxWidth: '1340px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <strong>Supplier Made Easy</strong> · Procurement Intelligence Engine v3.0
          </div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
            Product Identity Engine · 6-Metric Scoring · Base Currency: KES
          </div>
        </div>
      </footer>

    </div>
  );
}
