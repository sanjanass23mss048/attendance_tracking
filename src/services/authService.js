import {
  apiFetch,
  clearStoredUser,
  clearToken,
  getStoredUser,
  setRememberedEmail,
  setStoredUser,
  setToken,
  useMock,
} from './api.js';
import { clearClassesCache } from './classService.js';

const MOCK_USERS = {
  'incharge@brightfuture.edu.in': {
    id: 'mock-incharge',
    email: 'incharge@brightfuture.edu.in',
    name: 'A. Pune',
    role: 'INCHARGE',
  },
  'neha.sharma@brightfuture.edu.in': {
    id: 'mock-neha',
    email: 'neha.sharma@brightfuture.edu.in',
    name: 'Neha Sharma',
    role: 'TEACHER',
  },
  'rakesh.verma@brightfuture.edu.in': {
    id: 'mock-rakesh',
    email: 'rakesh.verma@brightfuture.edu.in',
    name: 'Rakesh Verma',
    role: 'TEACHER',
  },
};

/**
 * @param {{ email: string, password: string, rememberMe?: boolean }} credentials
 * @returns {Promise<{ token: string, user: object }>}
 */
export async function login({ email, password, rememberMe = false }) {
  clearClassesCache();

  if (useMock()) {
    const key = String(email || '').toLowerCase();
    const mockUser = MOCK_USERS[key];
    if (mockUser && password === 'password123') {
      const token = 'mock-jwt-token';
      setToken(token);
      setStoredUser(mockUser);
      if (rememberMe) setRememberedEmail(email);
      else setRememberedEmail('');
      return { token, user: mockUser };
    }
    const err = new Error('Invalid email or password');
    err.status = 401;
    throw err;
  }

  const data = await apiFetch('/api/auth/login', {
    method: 'POST',
    json: { email, password, rememberMe: Boolean(rememberMe) },
  });
  setToken(data.token);
  setStoredUser(data.user);
  if (rememberMe) setRememberedEmail(email);
  else setRememberedEmail('');
  return data;
}

export async function getMe() {
  if (useMock()) {
    const user = getStoredUser() || MOCK_USERS['incharge@brightfuture.edu.in'];
    return { user };
  }
  const data = await apiFetch('/api/me');
  setStoredUser(data.user);
  return data;
}

export function getCurrentUser() {
  return getStoredUser();
}

export function logout() {
  clearToken();
  clearStoredUser();
  clearClassesCache();
}
