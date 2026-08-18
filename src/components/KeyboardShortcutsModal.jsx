import { X, Keyboard } from 'lucide-react';

export default function KeyboardShortcutsModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  const shortcuts = [
    { key: '⌘ K / Ctrl K', desc: 'Open Command Palette & fast switcher' },
    { key: '/', desc: 'Focus global search input' },
    { key: 'P', desc: 'Navigate to Products & Comparison Matrix' },
    { key: 'O', desc: 'Navigate to Multi-Supplier Optimizer' },
    { key: 'S', desc: 'Navigate to Suppliers Directory' },
    { key: 'T', desc: 'Navigate to Price Trends Terminal' },
    { key: 'Q', desc: 'Navigate to Match Review Queue' },
    { key: 'I', desc: 'Open Ingestion Hub' },
    { key: '?', desc: 'Show this keyboard shortcuts guide' },
    { key: 'ESC', desc: 'Close open modal, drawer, or palette' }
  ];

  return (
    <div className="cmd-backdrop" onClick={onClose}>
      <div className="panel animate-fade" style={{ width: '480px', maxWidth: '90vw', padding: '20px', backgroundColor: 'var(--bg-surface)' }} onClick={(e) => e.stopPropagation()}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Keyboard size={18} color="var(--forest-bright)" />
            <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              Keyboard Navigation Shortcuts
            </h3>
          </div>
          <button onClick={onClose} className="btn-ghost" style={{ padding: '4px' }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {shortcuts.map((sc, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: i < shortcuts.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{sc.desc}</span>
              <kbd style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: '4px', padding: '2px 7px', fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--copper-text)', fontWeight: 600 }}>
                {sc.key}
              </kbd>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
