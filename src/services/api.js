import { tenantRequestHeaders } from '../lib/tenantHost.js';

const TOKEN_KEY = 'bfps_auth_token';
const USER_KEY = 'bfps_auth_user';
const REMEMBER_EMAIL_KEY = 'bfps_remember_email';

/**
 * API origin for fetch + Socket.IO.
 * - Dev: set VITE_API_URL=http://localhost:4000 (or leave empty and use Vite proxy)
 * - Prod: leave VITE_API_URL empty so the browser uses same-origin `/api`
 */
export const API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

/**
 * Mock mode only when VITE_USE_MOCK is explicitly `'true'`.
 * Default / `'false'` / unset → always use the live API (no silent demo data).
 */
export function useMock() {
  return import.meta.env.VITE_USE_MOCK === 'true';
}

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch (err) {
    const e = new Error('Could not save login session (browser storage blocked)');
    e.cause = err;
    throw e;
  }
}

export function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
}

export function getStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredUser(user) {
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  else localStorage.removeItem(USER_KEY);
}

export function clearStoredUser() {
  localStorage.removeItem(USER_KEY);
}

export function getRememberedEmail() {
  return localStorage.getItem(REMEMBER_EMAIL_KEY) || '';
}

export function setRememberedEmail(email) {
  if (email) localStorage.setItem(REMEMBER_EMAIL_KEY, email);
  else localStorage.removeItem(REMEMBER_EMAIL_KEY);
}

/**
 * Headers for every API call: auth + school subdomain (X-Tenant / X-Forwarded-Host).
 */
export function apiHeaders(extra = {}) {
  const headers = {
    Accept: 'application/json',
    ...tenantRequestHeaders(),
    ...extra,
  };
  const token = getToken();
  if (token && !headers.Authorization) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}
export async function apiFetch(path, options = {}) {
  const { json, headers: extraHeaders, ...rest } = options;
  const headers = apiHeaders(extraHeaders);

  if (json !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (rest.body instanceof FormData) {
    delete headers['Content-Type'];
  }

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...rest,
      headers,
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
  } catch (networkErr) {
    const err = new Error(
      API_BASE
        ? `Cannot reach server at ${API_BASE}`
        : 'Cannot reach server — is the API running?'
    );
    err.status = 0;
    err.isNetwork = true;
    err.cause = networkErr;
    throw err;
  }

  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text };
    }
  }

  if (!res.ok) {
    const err = new Error(data?.error || res.statusText || 'Request failed');
    err.status = res.status;
    err.data = data;
    // Session gone — clear stored auth so the app returns to login once.
    const skipAuthClear = [
      '/api/auth/login',
      '/api/auth/forgot-password',
      '/api/auth/reset-password',
    ];
    if (res.status === 401 && !skipAuthClear.includes(path)) {
      err.isAuth = true;
      clearToken();
      clearStoredUser();
      try {
        window.dispatchEvent(new CustomEvent('presence:auth-expired', { detail: err }));
      } catch {
        // ignore
      }
    }
    throw err;
  }

  return data;
}
