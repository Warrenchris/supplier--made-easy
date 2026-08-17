import { useState } from 'react';
import ComparisonBoard from './components/ComparisonBoard';
import MatchReviewQueue from './components/MatchReviewQueue';
import ImportHub from './components/ImportHub';
import SupplierManager from './components/SupplierManager';
import AdminSettings from './components/AdminSettings';
import { Package, Layers, GitMerge, Upload, Store, Sliders, Github } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('board');

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#0f1117' }}>
      
      {/* Primary Header Bar */}
      <header style={{ borderBottom: '1px solid #2b303d', background: '#181b24', padding: '14px 28px' }}>
        <div style={{ maxWidth: '1240px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: 'linear-gradient(135deg, #2dd4bf 0%, #3b82f6 100%)', borderRadius: '10px', padding: '8px', display: 'flex', color: '#0f1117' }}>
              <Package size={22} strokeWidth={2.5} />
            </div>
            <div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#f0f3f8', letterSpacing: '-0.01em' }}>
                Supplier Made Easy
              </div>
              <div style={{ fontSize: '11px', color: '#949eb2', fontFamily: "'IBM Plex Mono', monospace" }}>
                Enterprise Procurement & Intelligence Suite v2.0
              </div>
            </div>
          </div>

          {/* Operational Hub Navigation Tabs */}
          <nav style={{ display: 'flex', gap: '6px', background: '#0f1117', border: '1px solid #2b303d', padding: '4px', borderRadius: '10px' }}>
            {[
              ['board', 'Comparison Board', Layers],
              ['queue', 'Match Review Queue', GitMerge],
              ['import', 'Import & Ingestion', Upload],
              ['suppliers', 'Supplier Directory', Store],
              ['admin', 'Admin Settings', Sliders]
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
                    padding: '6px 14px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: isActive ? 600 : 400,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Icon size={15} /> {label}
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
              <Github size={16} /> GitHub Repo
            </a>
          </div>

        </div>
      </header>

      {/* Main Operational View */}
      <main style={{ flex: 1, padding: '24px 16px' }}>
        {activeTab === 'board' && <ComparisonBoard />}
        {activeTab === 'queue' && <MatchReviewQueue onUpdate={() => {}} />}
        {activeTab === 'import' && <ImportHub onImportSuccess={() => setActiveTab('board')} />}
        {activeTab === 'suppliers' && <SupplierManager />}
        {activeTab === 'admin' && <AdminSettings />}
      </main>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid #2b303d', padding: '16px 28px', background: '#181b24', color: '#949eb2', fontSize: '12px' }}>
        <div style={{ maxWidth: '1240px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <strong>Supplier Made Easy — Procurement Intelligence Engine</strong> · Deterministic & AI-Assisted Matching
          </div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
            Transactional SQL Engine · Base Currency: KES
          </div>
        </div>
      </footer>

    </div>
  );
}
