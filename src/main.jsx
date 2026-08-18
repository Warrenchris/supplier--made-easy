import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Global Auth Header Interceptor for API communication
const originalFetch = window.fetch;
window.fetch = function (url, options = {}) {
  const token = localStorage.getItem('sme_auth_token') || 'admin-token';
  const headers = new Headers(options.headers || {});
  if (!headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return originalFetch(url, { ...options, headers });
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
