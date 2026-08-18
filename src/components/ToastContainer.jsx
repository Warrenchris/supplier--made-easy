import React, { useContext } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import ToastContext from '../context/ToastContext';

export default function ToastContainer() {
  const context = useContext(ToastContext);
  if (!context || !context.toasts || context.toasts.length === 0) return null;

  const { toasts, removeToast } = context;

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        maxWidth: '420px',
        width: 'calc(100vw - 48px)',
        pointerEvents: 'none'
      }}
    >
      {toasts.map((t) => {
        const isError = t.type === 'error';
        const isWarning = t.type === 'warning';
        const isSuccess = t.type === 'success';

        let borderAccent = 'var(--forest-bright)';
        let iconColor = 'var(--forest-bright)';
        let IconComp = CheckCircle2;
        let bgTint = 'rgba(47, 107, 82, 0.08)';

        if (isError) {
          borderAccent = 'var(--color-danger-text)';
          iconColor = 'var(--color-danger-text)';
          IconComp = AlertCircle;
          bgTint = 'rgba(239, 68, 68, 0.12)';
        } else if (isWarning) {
          borderAccent = 'var(--amber-bright)';
          iconColor = 'var(--amber-bright)';
          IconComp = AlertTriangle;
          bgTint = 'rgba(217, 119, 6, 0.10)';
        } else if (t.type === 'info') {
          borderAccent = 'var(--copper-bright)';
          iconColor = 'var(--copper-bright)';
          IconComp = Info;
          bgTint = 'rgba(180, 110, 60, 0.10)';
        }

        return (
          <div
            key={t.id}
            role={isError ? 'alert' : 'status'}
            aria-live={isError ? 'assertive' : 'polite'}
            style={{
              pointerEvents: 'auto',
              background: 'var(--bg-elevated)',
              backgroundColor: 'rgba(22, 25, 31, 0.96)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid var(--border-default)',
              borderLeft: `4px solid ${borderAccent}`,
              borderRadius: 'var(--radius-sm)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.45)',
              padding: '12px 14px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              animation: 'slideUpFade 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              transition: 'all 0.2s ease',
              position: 'relative'
            }}
          >
            <div style={{ color: iconColor, marginTop: '2px', flexShrink: 0 }}>
              <IconComp size={18} />
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              {t.title && (
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2px' }}>
                  {t.title}
                </div>
              )}
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.45', wordBreak: 'break-word' }}>
                {t.message}
              </div>

              {t.action && (
                <div style={{ marginTop: '8px' }}>
                  <button
                    onClick={() => {
                      if (t.action.onClick) t.action.onClick();
                      removeToast(t.id);
                    }}
                    className="btn-primary"
                    style={{ fontSize: '11px', padding: '3px 8px' }}
                  >
                    {t.action.label}
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={() => removeToast(t.id)}
              className="btn-ghost"
              style={{
                padding: '4px',
                color: 'var(--text-muted)',
                borderRadius: 'var(--radius-xs)',
                cursor: 'pointer',
                flexShrink: 0,
                marginTop: '-2px',
                marginRight: '-4px'
              }}
              title="Dismiss notification"
              aria-label="Dismiss notification"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
