import { useState, useEffect, useRef } from 'react';
import OverviewDashboard from './components/OverviewDashboard';
import ComparisonBoard from './components/ComparisonBoard';
import MatchReviewQueue from './components/MatchReviewQueue';
import ImportHub from './components/ImportHub';
import SupplierManager from './components/SupplierManager';
import AdminSettings from './components/AdminSettings';
import ProcurementOptimizer from './components/ProcurementOptimizer';
import PriceTrendTracker from './components/PriceTrendTracker';
import StorefrontSync from './components/StorefrontSync';
import CommandPalette from './components/CommandPalette';
import KeyboardShortcutsModal from './components/KeyboardShortcutsModal';
import { 
  Package, Layers, GitMerge, Upload, Store, 
  Sliders, Target, TrendingUp, ShoppingCart, 
  Search, Bell, User, ChevronRight, FileText, 
  Download, CheckCircle2, AlertTriangle, ShieldCheck, 
  ExternalLink, Sparkles, Building2, HelpCircle, Keyboard
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useToast } from './context/ToastContext';

export default function App() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('overview');
  const [currentRole, setCurrentRole] = useState(() => {
    const token = localStorage.getItem('sme_auth_token') || 'admin-token';
    if (token.startsWith('buyer')) return 'buyer';
    if (token.startsWith('viewer')) return 'viewer';
    return 'admin';
  });
  const [optimizerProduct, setOptimizerProduct] = useState(null);
  const [globalSearch, setGlobalSearch] = useState('');
  const [pendingReviewsCount, setPendingReviewsCount] = useState(0);
  const [productsList, setProductsList] = useState([]);
  const [draftPOs, setDraftPOs] = useState([]);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const searchInputRef = useRef(null);

  // Fetch background notifications, product catalog for palette, & review counts
  useEffect(() => {
    const fetchTelemetry = async () => {
      try {
        const [matchRes, poRes, prodRes] = await Promise.all([
          fetch('/api/match-suggestions').then((r) => r.json()),
          fetch('/api/purchase-orders/draft', { method: 'POST' }).then((r) => r.json()),
          fetch('/api/canonical-products').then((r) => r.json())
        ]);
        if (Array.isArray(matchRes)) setPendingReviewsCount(matchRes.length);
        if (Array.isArray(poRes)) setDraftPOs(poRes);
        if (Array.isArray(prodRes)) setProductsList(prodRes);
      } catch (err) {
        console.error('Telemetry fetch error:', err);
      }
    };

    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 30000);
    return () => clearInterval(interval);
  }, []);

  // Global Keyboard Shortcuts (⌘K, /, P, O, S, T, Q, I, ?)
  useEffect(() => {
    const handleKeyDown = (e) => {
      const isInputActive = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);

      // ⌘K or Ctrl+K -> Command Palette
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setShowCommandPalette((prev) => !prev);
        return;
      }

      // If typing in input, ignore single-letter navigation shortcuts
      if (isInputActive) {
        if (e.key === 'Escape') {
          document.activeElement.blur();
        }
        return;
      }

      if (e.key === '/') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'p' || e.key === 'P') {
        setActiveTab('products');
      } else if (e.key === 'o' || e.key === 'O') {
        setActiveTab('optimizer');
      } else if (e.key === 's' || e.key === 'S') {
        setActiveTab('suppliers');
      } else if (e.key === 't' || e.key === 'T') {
        setActiveTab('trends');
      } else if (e.key === 'q' || e.key === 'Q') {
        setActiveTab('queue');
      } else if (e.key === 'i' || e.key === 'I') {
        setActiveTab('import');
      } else if (e.key === '?') {
        setShowShortcutsModal(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleNavigate = (tab, payload = null) => {
    if (tab === 'optimizer' && payload) {
      setOptimizerProduct(payload);
    }
    setActiveTab(tab);
  };

  const exportAllPOs = () => {
    if (!draftPOs.length) return;
    const rows = [];
    draftPOs.forEach((group) => {
      const sup = group.supplier || {};
      (group.items || []).forEach((item) => {
        rows.push({
          'Supplier': sup.name || 'Vendor',
          'Contact': sup.contact_info || '',
          'Product Name': item.productName,
          'SKU': item.sku,
          'Unit Price': item.cost,
          'Currency': item.currency,
          'Unit Cost (KES)': Math.round(item.costInKES)
        });
      });
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Draft Purchase Orders');
    XLSX.writeFile(wb, `Purchase_Orders_Draft_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-primary)' }}>
      
      {/* ─── Top Command Bar ─── */}
      <header 
        style={{ 
          height: '52px', 
          backgroundColor: 'var(--bg-surface)', 
          borderBottom: '1px solid var(--border-default)', 
          padding: '0 20px', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          zIndex: 100,
          position: 'sticky',
          top: 0
        }}
      >
        {/* Brand & Identity */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div 
            onClick={() => setActiveTab('overview')}
            style={{ 
              backgroundColor: 'var(--forest-primary)', 
              color: '#F7F5EF', 
              width: '28px', 
              height: '28px', 
              borderRadius: 'var(--radius-xs)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              cursor: 'pointer',
              border: '1px solid var(--forest-hover)'
            }}
          >
            <Package size={16} />
          </div>

          <div 
            onClick={() => setActiveTab('overview')}
            style={{ cursor: 'pointer' }}
          >
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em', lineHeight: 1.2 }}>
              Supplier Made Easy
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              Procurement Intelligence OS
            </div>
          </div>
        </div>

        {/* Global Command Search / Palette Trigger */}
        <div 
          onClick={() => setShowCommandPalette(true)}
          style={{ position: 'relative', width: '380px', maxWidth: '40vw', cursor: 'pointer' }}
        >
          <Search size={13} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            ref={searchInputRef}
            readOnly
            value={globalSearch}
            placeholder="Search catalog or press ⌘K for command palette..."
            style={{ 
              width: '100%', 
              paddingLeft: '30px', 
              paddingRight: '60px',
              paddingTop: '6px',
              paddingBottom: '6px',
              fontSize: '12px',
              height: '32px',
              backgroundColor: 'var(--bg-primary)',
              cursor: 'pointer'
            }}
          />
          <span 
            style={{ 
              position: 'absolute', 
              right: '8px', 
              top: '50%', 
              transform: 'translateY(-50%)', 
              fontSize: '10px', 
              color: 'var(--text-muted)', 
              fontFamily: 'var(--font-mono)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '3px',
              padding: '1px 5px',
              background: 'var(--bg-elevated)'
            }}
          >
            ⌘K
          </span>
        </div>

        {/* Quick Actions & User Telemetry */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          
          {/* Base Currency Badge */}
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', padding: '4px 8px', borderRadius: 'var(--radius-xs)', fontFamily: 'var(--font-mono)' }}>
            Base: <strong style={{ color: 'var(--forest-bright)' }}>KES</strong>
          </div>

          {/* Import Quick Button */}
          <button 
            onClick={() => setActiveTab('import')}
            className="btn-primary" 
            style={{ fontSize: '12px', padding: '5px 10px', height: '30px' }}
          >
            <Upload size={13} /> + Import Price List
          </button>

          {/* Keyboard Shortcuts Guide Trigger */}
          <button
            onClick={() => setShowShortcutsModal(true)}
            className="btn-ghost"
            style={{ padding: '6px' }}
            title="Keyboard Shortcuts (?)"
          >
            <Keyboard size={15} />
          </button>

          {/* Notifications Trigger */}
          <button 
            onClick={() => setShowAlertModal(!showAlertModal)}
            className="btn-ghost" 
            style={{ position: 'relative', padding: '6px' }}
            title="Procurement Alerts"
          >
            <Bell size={16} />
            {pendingReviewsCount > 0 && (
              <span 
                style={{ 
                  position: 'absolute', 
                  top: '2px', 
                  right: '2px', 
                  width: '7px', 
                  height: '7px', 
                  backgroundColor: 'var(--copper-primary)', 
                  borderRadius: '50%' 
                }} 
              />
            )}
          </button>

          {/* User Profile & Role Switcher */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '8px', borderLeft: '1px solid var(--border-subtle)' }}>
            <div style={{ width: '26px', height: '26px', borderRadius: 'var(--radius-xs)', backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--forest-bright)' }}>
              <User size={14} />
            </div>
            <select
              value={currentRole}
              onChange={(e) => {
                const role = e.target.value;
                setCurrentRole(role);
                localStorage.setItem('sme_auth_token', `${role}-token`);
                toast.info(`Switched active session to ${role.toUpperCase()} role.`, 'Active Role Changed');
              }}
              style={{ fontSize: '11px', padding: '2px 6px', height: '26px', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-xs)', color: 'var(--text-secondary)' }}
            >
              <option value="admin">Admin (Full Access)</option>
              <option value="buyer">Buyer (Operational)</option>
              <option value="viewer">Viewer (Read Only)</option>
            </select>
          </div>

        </div>
      </header>

      {/* ─── Two-Column Operations Layout ─── */}
      <div style={{ flex: 1, display: 'flex' }}>
        
        {/* Left Navigation Sidebar Rail */}
        <aside 
          style={{ 
            width: '210px', 
            backgroundColor: 'var(--bg-surface)', 
            borderRight: '1px solid var(--border-default)', 
            padding: '16px 10px', 
            display: 'flex', 
            flexDirection: 'column', 
            justifyContent: 'space-between',
            flexShrink: 0
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            
            {/* Section: WORKSPACE */}
            <div>
              <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0 8px', marginBottom: '4px' }}>
                Workspace
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                {[
                  ['overview', 'Overview', Package, null],
                  ['products', 'Products', Layers, null],
                  ['suppliers', 'Suppliers', Store, null],
                  ['optimizer', 'Procurement', Target, 'Optimized'],
                  ['orders', 'Purchase Orders', FileText, draftPOs.length ? `${draftPOs.length}` : null]
                ].map(([key, label, Icon, badge]) => {
                  const isActive = activeTab === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setActiveTab(key)}
                      style={{
                        width: '100%',
                        justifyContent: 'space-between',
                        padding: '7px 10px',
                        borderRadius: 'var(--radius-xs)',
                        backgroundColor: isActive ? 'var(--bg-elevated)' : 'transparent',
                        color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                        border: `1px solid ${isActive ? 'var(--border-subtle)' : 'transparent'}`,
                        fontWeight: isActive ? 600 : 400,
                        fontSize: '12px'
                      }}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                        <Icon size={14} color={isActive ? 'var(--forest-bright)' : 'var(--text-muted)'} />
                        {label}
                      </span>
                      {badge && (
                        <span className="badge badge-neutral" style={{ fontSize: '9px', padding: '1px 5px' }}>
                          {badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Section: INTELLIGENCE */}
            <div>
              <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0 8px', marginBottom: '4px' }}>
                Intelligence
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                {[
                  ['trends', 'Price Trends', TrendingUp, null],
                  ['queue', 'Match Review', GitMerge, pendingReviewsCount > 0 ? `${pendingReviewsCount}` : null]
                ].map(([key, label, Icon, badge]) => {
                  const isActive = activeTab === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setActiveTab(key)}
                      style={{
                        width: '100%',
                        justifyContent: 'space-between',
                        padding: '7px 10px',
                        borderRadius: 'var(--radius-xs)',
                        backgroundColor: isActive ? 'var(--bg-elevated)' : 'transparent',
                        color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                        border: `1px solid ${isActive ? 'var(--border-subtle)' : 'transparent'}`,
                        fontWeight: isActive ? 600 : 400,
                        fontSize: '12px'
                      }}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                        <Icon size={14} color={isActive ? 'var(--copper-text)' : 'var(--text-muted)'} />
                        {label}
                      </span>
                      {badge && (
                        <span className="badge badge-warning" style={{ fontSize: '9px', padding: '1px 5px' }}>
                          {badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Section: COMMERCE */}
            <div>
              <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0 8px', marginBottom: '4px' }}>
                Commerce
              </div>
              <button
                onClick={() => setActiveTab('storefront')}
                style={{
                  width: '100%',
                  justifyContent: 'flex-start',
                  padding: '7px 10px',
                  borderRadius: 'var(--radius-xs)',
                  backgroundColor: activeTab === 'storefront' ? 'var(--bg-elevated)' : 'transparent',
                  color: activeTab === 'storefront' ? 'var(--text-primary)' : 'var(--text-muted)',
                  border: `1px solid ${activeTab === 'storefront' ? 'var(--border-subtle)' : 'transparent'}`,
                  fontWeight: activeTab === 'storefront' ? 600 : 400,
                  fontSize: '12px',
                  gap: '8px'
                }}
              >
                <ShoppingCart size={14} color={activeTab === 'storefront' ? 'var(--forest-bright)' : 'var(--text-muted)'} />
                Realmer Storefront
              </button>
            </div>

            {/* Section: SYSTEM */}
            <div>
              <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0 8px', marginBottom: '4px' }}>
                System
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                {[
                  ['import', 'Import Hub', Upload],
                  ['settings', 'Settings', Sliders]
                ].map(([key, label, Icon]) => {
                  const isActive = activeTab === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setActiveTab(key)}
                      style={{
                        width: '100%',
                        justifyContent: 'flex-start',
                        padding: '7px 10px',
                        borderRadius: 'var(--radius-xs)',
                        backgroundColor: isActive ? 'var(--bg-elevated)' : 'transparent',
                        color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                        border: `1px solid ${isActive ? 'var(--border-subtle)' : 'transparent'}`,
                        fontWeight: isActive ? 600 : 400,
                        fontSize: '12px',
                        gap: '8px'
                      }}
                    >
                      <Icon size={14} color={isActive ? 'var(--forest-bright)' : 'var(--text-muted)'} />
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

          </div>

          {/* System Footer Note */}
          <div style={{ padding: '8px', borderTop: '1px solid var(--border-subtle)', fontSize: '11px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
            <div>Press <strong>?</strong> for shortcuts</div>
            <div style={{ marginTop: '2px' }}>SME Engine v3.1</div>
          </div>
        </aside>

        {/* ─── Main Operations Screen ─── */}
        <main style={{ flex: 1, padding: '24px 28px', overflowY: 'auto' }}>
          
          {activeTab === 'overview' && (
            <OverviewDashboard 
              onNavigate={handleNavigate}
              onOpenImport={() => setActiveTab('import')}
            />
          )}

          {activeTab === 'products' && (
            <ComparisonBoard 
              onOptimizeProduct={(prod) => handleNavigate('optimizer', prod)}
            />
          )}

          {activeTab === 'optimizer' && (
            <ProcurementOptimizer 
              preselectedProduct={optimizerProduct}
            />
          )}

          {activeTab === 'suppliers' && (
            <SupplierManager />
          )}

          {activeTab === 'trends' && (
            <PriceTrendTracker />
          )}

          {activeTab === 'queue' && (
            <MatchReviewQueue 
              onUpdate={() => setPendingReviewsCount((prev) => Math.max(0, prev - 1))}
            />
          )}

          {activeTab === 'storefront' && (
            <StorefrontSync />
          )}

          {activeTab === 'import' && (
            <ImportHub 
              onImportSuccess={() => setActiveTab('products')}
              onNavigateQueue={() => setActiveTab('review')}
            />
          )}

          {activeTab === 'settings' && (
            <AdminSettings />
          )}

          {activeTab === 'orders' && (
            <div className="animate-fade" style={{ maxWidth: '1280px', margin: '0 auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '20px' }}>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--forest-text)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
                    Fulfillment Execution
                  </div>
                  <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                    Draft Purchase Orders & Supplier Batching
                  </h1>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Consolidated purchase order drafts automatically grouped by recommended sourcing vendor.
                  </p>
                </div>

                <button onClick={exportAllPOs} className="btn-secondary" style={{ fontSize: '12px' }}>
                  <Download size={14} /> Export All Draft POs (.xlsx)
                </button>
              </div>

              {draftPOs.length === 0 ? (
                <div className="panel" style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <FileText size={32} style={{ opacity: 0.5, marginBottom: '8px' }} />
                  <div style={{ fontSize: '15px', fontWeight: 600 }}>No Purchase Orders Ready for Drafting</div>
                  <div style={{ fontSize: '12px', marginTop: '4px' }}>
                    Import catalog pricelists or configure optimization allocations to generate batch vendor orders.
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {draftPOs.map((group, idx) => {
                    const sup = group.supplier || {};
                    const items = group.items || [];
                    const groupTotal = items.reduce((sum, i) => sum + (i.costInKES || 0), 0);

                    return (
                      <div key={idx} className="panel" style={{ overflow: 'hidden' }}>
                        <div className="panel-header" style={{ background: 'var(--bg-elevated)' }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>
                              PO Batch: {sup.name || 'Vendor'}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                              Contact: {sup.contact_info || 'Direct'} · Lead Time: {sup.avg_delivery_days ? `${sup.avg_delivery_days}d` : '3d'}
                            </div>
                          </div>

                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Vendor Batch Total</div>
                            <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--forest-bright)', fontFamily: 'var(--font-mono)' }}>
                              KSh {Math.round(groupTotal).toLocaleString()}
                            </div>
                          </div>
                        </div>

                        <table className="enterprise-table">
                          <thead>
                            <tr>
                              <th>Product Name</th>
                              <th>Vendor SKU</th>
                              <th style={{ textAlign: 'right' }}>Unit Cost</th>
                              <th style={{ textAlign: 'right' }}>Unit Cost (KES)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {items.map((item, iIdx) => (
                              <tr key={iIdx}>
                                <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.productName}</td>
                                <td style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>{item.sku || '—'}</td>
                                <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{item.cost} {item.currency}</td>
                                <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>KSh {Math.round(item.costInKES).toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

        </main>

      </div>

      {/* ─── Command Palette Modal (⌘K) ─── */}
      <CommandPalette 
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        onNavigate={handleNavigate}
        products={productsList}
      />

      {/* ─── Keyboard Shortcuts Modal (?) ─── */}
      <KeyboardShortcutsModal
        isOpen={showShortcutsModal}
        onClose={() => setShowShortcutsModal(false)}
      />

      {/* ─── Operational Alerts Modal ─── */}
      {showAlertModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', padding: '60px 24px' }}>
          <div className="panel animate-fade" style={{ width: '360px', padding: '18px', backgroundColor: 'var(--bg-surface)', boxShadow: '0 10px 40px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Procurement Telemetry & Alerts
              </div>
              <button onClick={() => setShowAlertModal(false)} className="btn-ghost" style={{ padding: '2px' }}>
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px' }}>
              <div style={{ padding: '10px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontWeight: 600, color: 'var(--copper-text)', marginBottom: '2px' }}>Match Review Queue</div>
                <div style={{ color: 'var(--text-muted)' }}>{pendingReviewsCount} supplier listings pending manual verification.</div>
              </div>

              <div style={{ padding: '10px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontWeight: 600, color: 'var(--forest-bright)', marginBottom: '2px' }}>Base Currency Guard</div>
                <div style={{ color: 'var(--text-muted)' }}>All foreign pricelist rows actively normalized to KES identity base.</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Footer ─── */}
      <footer style={{ borderTop: '1px solid var(--border-default)', padding: '10px 24px', backgroundColor: 'var(--bg-surface)', color: 'var(--text-muted)', fontSize: '11px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <strong style={{ color: 'var(--text-secondary)' }}>Supplier Made Easy</strong> · Enterprise Procurement Intelligence Operating System
        </div>
        <div style={{ fontFamily: 'var(--font-mono)' }}>
          Base: KES · 6-Metric Scoring · Press <strong>⌘K</strong> for Command Center
        </div>
      </footer>

    </div>
  );
}
