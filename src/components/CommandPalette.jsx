import { useState, useEffect, useRef } from 'react';
import { 
  Search, Package, Layers, Store, Target, 
  TrendingUp, GitMerge, ShoppingCart, Upload, 
  Sliders, ArrowRight, X, Download, Zap
} from 'lucide-react';

export default function CommandPalette({ isOpen, onClose, onNavigate, products = [] }) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const baseActions = [
    { id: 'overview', label: 'Go to Overview Dashboard', icon: Package, category: 'Navigation', shortcut: 'O', action: () => onNavigate('overview') },
    { id: 'products', label: 'Go to Products & Comparison Matrix', icon: Layers, category: 'Navigation', shortcut: 'P', action: () => onNavigate('products') },
    { id: 'optimizer', label: 'Go to Multi-Supplier Optimizer', icon: Target, category: 'Navigation', shortcut: 'M', action: () => onNavigate('optimizer') },
    { id: 'suppliers', label: 'Go to Supplier Directory', icon: Store, category: 'Navigation', shortcut: 'S', action: () => onNavigate('suppliers') },
    { id: 'trends', label: 'Go to Market Price Trends', icon: TrendingUp, category: 'Navigation', shortcut: 'T', action: () => onNavigate('trends') },
    { id: 'queue', label: 'Go to Match Review Queue', icon: GitMerge, category: 'Navigation', shortcut: 'Q', action: () => onNavigate('queue') },
    { id: 'storefront', label: 'Go to Realmer Storefront Sync', icon: ShoppingCart, category: 'Navigation', shortcut: 'R', action: () => onNavigate('storefront') },
    { id: 'import', label: 'Import Supplier Pricelist (.xlsx, .csv)', icon: Upload, category: 'Actions', shortcut: 'I', action: () => onNavigate('import') },
    { id: 'settings', label: 'Configure Scoring Weights & Exchange Rates', icon: Sliders, category: 'Settings', shortcut: 'G', action: () => onNavigate('settings') },
  ];

  // Dynamic product jump items
  const productItems = (products || []).slice(0, 10).map((p) => ({
    id: `prod_${p.id}`,
    label: `Inspect ${p.canonical_name}`,
    icon: Zap,
    category: 'Products',
    shortcut: p.brand || '',
    action: () => onNavigate('products', p)
  }));

  const allItems = [...baseActions, ...productItems];

  const filtered = allItems.filter((item) => {
    if (!query) return true;
    return item.label.toLowerCase().includes(query.toLowerCase()) || item.category.toLowerCase().includes(query.toLowerCase());
  });

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = filtered[selectedIndex];
      if (target) {
        target.action();
        onClose();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="cmd-backdrop" onClick={onClose}>
      <div className="cmd-dialog" onClick={(e) => e.stopPropagation()} onKeyDown={handleKeyDown}>
        
        {/* Search Header */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--border-default)', gap: '10px' }}>
          <Search size={16} color="var(--text-muted)" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
            placeholder="Type a command, screen, or product name..."
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              padding: 0,
              fontSize: '14px',
              color: 'var(--text-primary)',
              outline: 'none'
            }}
          />
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', border: '1px solid var(--border-subtle)', padding: '1px 5px', borderRadius: '3px' }}>
            ESC
          </span>
        </div>

        {/* Results List */}
        <div style={{ maxHeight: '360px', overflowY: 'auto', padding: '6px' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
              No matching commands or products found.
            </div>
          ) : (
            filtered.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              const Icon = item.icon;
              return (
                <div
                  key={item.id}
                  onClick={() => { item.action(); onClose(); }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-xs)',
                    backgroundColor: isSelected ? 'var(--bg-elevated)' : 'transparent',
                    color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontSize: '13px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Icon size={15} color={isSelected ? 'var(--forest-bright)' : 'var(--text-muted)'} />
                    <span>{item.label}</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      {item.category}
                    </span>
                    {item.shortcut && (
                      <span className="badge badge-neutral font-mono" style={{ fontSize: '10px' }}>
                        {item.shortcut}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div style={{ padding: '8px 16px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', background: 'var(--bg-primary)' }}>
          <span>Navigate: <strong style={{ color: 'var(--text-secondary)' }}>↑ ↓</strong></span>
          <span>Select: <strong style={{ color: 'var(--text-secondary)' }}>↵ Enter</strong></span>
          <span>Close: <strong style={{ color: 'var(--text-secondary)' }}>ESC</strong></span>
        </div>

      </div>
    </div>
  );
}
