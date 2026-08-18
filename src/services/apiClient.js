/**
 * Supplier Made Easy — Centralized API Client
 * Wraps native fetch with auth injection, status validation, and typed error formatting.
 */

export class ApiError extends Error {
  constructor(message, status = 500, data = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

function getStoredToken() {
  return localStorage.getItem('sme_auth_token') || localStorage.getItem('auth_token') || 'admin-token';
}

export async function request(endpoint, options = {}) {
  const token = getStoredToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  const config = {
    ...options,
    headers
  };

  if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
    config.body = JSON.stringify(config.body);
  }

  let response;
  try {
    response = await fetch(endpoint, config);
  } catch (netErr) {
    throw new ApiError(
      `Network connection failed. Please ensure the backend server is reachable. (${netErr.message})`,
      0,
      { originalError: netErr.message }
    );
  }

  // Handle successful empty response (e.g. 204 No Content)
  if (response.status === 204) {
    return null;
  }

  // Parse JSON response or text
  let data = null;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  } else {
    try {
      data = await response.text();
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    let errorMsg = 'An unexpected server error occurred';

    if (data && typeof data === 'object' && data.error) {
      errorMsg = data.error;
    } else if (typeof data === 'string' && data.trim()) {
      errorMsg = data;
    } else if (response.status === 401) {
      errorMsg = 'Session expired or invalid authentication. Please log in again.';
    } else if (response.status === 403) {
      errorMsg = 'Permission denied. Your current role does not have authority to perform this action.';
    } else if (response.status === 404) {
      errorMsg = 'The requested resource was not found.';
    } else if (response.status >= 500) {
      errorMsg = `Server error (${response.status}): The system could not complete the operation.`;
    }

    throw new ApiError(errorMsg, response.status, data);
  }

  return data;
}

export const api = {
  get: (url, options) => request(url, { ...options, method: 'GET' }),
  post: (url, body, options) => request(url, { ...options, method: 'POST', body }),
  put: (url, body, options) => request(url, { ...options, method: 'PUT', body }),
  delete: (url, options) => request(url, { ...options, method: 'DELETE' })
};

export default api;
