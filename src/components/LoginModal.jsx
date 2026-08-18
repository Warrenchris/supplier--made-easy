import React, { useState } from 'react';
import { Lock, Mail, ShieldCheck, Key, ArrowRight, RefreshCw, User, Package, AlertCircle } from 'lucide-react';
import api from '../services/apiClient';
import { useToast } from '../context/ToastContext';

const PRESET_CREDENTIALS = [
  {
    role: 'admin',
    label: 'Lead Administrator',
    badge: 'Full Access',
    email: 'admin@supplier-made-easy.co.ke',
    password: 'AdminPass2026!',
    color: 'var(--forest-bright)',
    bg: 'var(--forest-light)'
  },
  {
    role: 'buyer',
    label: 'Senior Buyer',
    badge: 'Operations',
    email: 'buyer@supplier-made-easy.co.ke',
    password: 'BuyerPass2026!',
    color: 'var(--copper-bright)',
    bg: 'var(--copper-light)'
  },
  {
    role: 'viewer',
    label: 'Auditor / Viewer',
    badge: 'Read Only',
    email: 'viewer@supplier-made-easy.co.ke',
    password: 'ViewerPass2026!',
    color: 'var(--text-muted)',
    bg: 'var(--bg-elevated)'
  }
];

export default function LoginModal({ onLoginSuccess }) {
  const [email, setEmail] = useState('admin@supplier-made-easy.co.ke');
  const [password, setPassword] = useState('AdminPass2026!');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const toast = useToast();

  const handleLogin = async (e) => {
    if (e) e.preventDefault();
    if (!email || !password) {
      setErrorMsg('Please enter both your email address and password.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const res = await api.post('/api/auth/login', {
        email: email.trim(),
        password: password
      });

      if (res && res.token) {
        localStorage.setItem('sme_auth_token', res.token);
        localStorage.setItem('sme_user_info', JSON.stringify(res.user));
        toast.success(`Authenticated as ${res.user.name} (${res.user.role.toUpperCase()})`, 'Login Successful');
        if (onLoginSuccess) onLoginSuccess(res.user);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Invalid email or password.');
      toast.error(err.message, 'Authentication Failed');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = (preset) => {
    setEmail(preset.email);
    setPassword(preset.password);
    setErrorMsg('');
  };

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(10, 12, 14, 0.88)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
    >
      <div
        className="panel animate-fade"
        style={{
          maxWidth: '460px',
          width: '100%',
          padding: '32px 28px',
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-strong)',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.65)',
          borderRadius: 'var(--radius-md)'
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div 
            style={{ 
              background: 'var(--forest-light)', 
              width: '48px', 
              height: '48px', 
              borderRadius: 'var(--radius-sm)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              margin: '0 auto 12px',
              border: '1px solid var(--forest-border)'
            }}
          >
            <ShieldCheck size={24} color="var(--forest-bright)" />
          </div>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px 0' }}>
            Supplier Made Easy
          </h2>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Enterprise Procurement Intelligence & Operations OS
          </div>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div 
            role="alert"
            style={{
              padding: '10px 14px',
              marginBottom: '16px',
              backgroundColor: 'var(--color-danger-bg)',
              border: '1px solid var(--color-danger)',
              borderRadius: 'var(--radius-xs)',
              color: 'var(--color-danger-text)',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <AlertCircle size={15} style={{ flexShrink: 0 }} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Credentials Form */}
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '14px' }}>
            <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
              Email Address
            </label>
            <div style={{ position: 'relative' }}>
              <Mail size={14} color="var(--text-dim)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                style={{ width: '100%', paddingLeft: '32px' }}
              />
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <Key size={14} color="var(--text-dim)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                style={{ width: '100%', paddingLeft: '32px' }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
            style={{ width: '100%', height: '36px', fontSize: '13px', justifyContent: 'center' }}
          >
            {loading ? (
              <>
                <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Authenticating...
              </>
            ) : (
              <>
                Sign In to Platform <ArrowRight size={14} />
              </>
            )}
          </button>
        </form>

        {/* Quick Role Fill Section for Testing & Operational Switching */}
        <div style={{ marginTop: '24px', paddingTop: '18px', borderTop: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px', textAlign: 'center' }}>
            Or Select Pre-Configured Role Credentials
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {PRESET_CREDENTIALS.map((p) => (
              <button
                key={p.role}
                type="button"
                onClick={() => handleQuickFill(p)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-xs)',
                  background: email === p.email ? 'var(--bg-active)' : 'var(--bg-elevated)',
                  border: `1px solid ${email === p.email ? p.color : 'var(--border-subtle)'}`,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <User size={13} color={p.color} />
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{p.label}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>{p.email}</div>
                  </div>
                </div>
                <span style={{ fontSize: '10px', fontWeight: 600, color: p.color, background: p.bg, padding: '2px 6px', borderRadius: '3px' }}>
                  {p.badge}
                </span>
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
