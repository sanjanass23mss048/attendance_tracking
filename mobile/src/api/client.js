import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from '../config';

const TOKEN_KEY = 'presence_auth_token';
const USER_KEY = 'presence_auth_user';

export async function getToken() {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function setToken(token) {
  if (token) await AsyncStorage.setItem(TOKEN_KEY, token);
  else await AsyncStorage.removeItem(TOKEN_KEY);
}

export async function getStoredUser() {
  try {
    const raw = await AsyncStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function setStoredUser(user) {
  if (user) await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
  else await AsyncStorage.removeItem(USER_KEY);
}

export async function clearSession() {
  await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
}

/**
 * @param {string} path - e.g. `/api/classes`
 * @param {RequestInit & { json?: unknown }} [options]
 */
export async function apiFetch(path, options = {}) {
  const { json, headers: extraHeaders, ...rest } = options;
  const headers = {
    Accept: 'application/json',
    ...extraHeaders,
  };

  if (json !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const token = await getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const url = `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
  const res = await fetch(url, {
    ...rest,
    headers,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    const err = new Error(data?.error || data?.message || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}
