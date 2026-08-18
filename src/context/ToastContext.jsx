import React, { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

let toastCount = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(({ type = 'info', title, message, duration, action }) => {
    const id = `toast_${Date.now()}_${++toastCount}`;

    // By default:
    // errors NEVER auto-dismiss (duration = 0 / null)
    // warnings auto-dismiss after 7s
    // success and info auto-dismiss after 4.5s
    let effectiveDuration = duration;
    if (effectiveDuration === undefined) {
      if (type === 'error') {
        effectiveDuration = null; // Do not auto-dismiss errors!
      } else if (type === 'warning') {
        effectiveDuration = 7000;
      } else {
        effectiveDuration = 4500;
      }
    }

    const newToast = {
      id,
      type,
      title,
      message,
      action,
      createdAt: Date.now()
    };

    setToasts((prev) => [...prev, newToast]);

    if (effectiveDuration && effectiveDuration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, effectiveDuration);
    }

    return id;
  }, [removeToast]);

  const toast = {
    success: (message, title = 'Operation Successful', options = {}) =>
      addToast({ type: 'success', title, message, ...options }),
    
    error: (message, title = 'Operation Failed', options = {}) =>
      addToast({ type: 'error', title, message, ...options }),
    
    warning: (message, title = 'Attention Required', options = {}) =>
      addToast({ type: 'warning', title, message, ...options }),
    
    info: (message, title = 'Notification', options = {}) =>
      addToast({ type: 'info', title, message, ...options }),
    
    dismiss: removeToast,
    clearAll: () => setToasts([])
  };

  return (
    <ToastContext.Provider value={{ toasts, toast, removeToast }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context.toast;
}

export default ToastContext;
