import {
  apiFetch,
  clearStoredUser,
  clearToken,
  getStoredUser,
  getToken,
  setRememberedEmail,
  setStoredUser,
  setToken,
  useMock,
} from './api.js';
import { clearClassesCache } from './classService.js';

const MOCK_USERS = {
  'admin@brightfuture.edu.in': {
    id: 'mock-admin',
    email: 'admin@brightfuture.edu.in',
    name: 'School Admin',
    role: 'ADMIN',
  },
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
  'priya.nair@brightfuture.edu.in': {
    id: 'mock-priya',
    email: 'priya.nair@brightfuture.edu.in',
    name: 'Priya Nair',
    role: 'TEACHER',
  },
  'anil.kumar@brightfuture.edu.in': {
    id: 'mock-anil',
    email: 'anil.kumar@brightfuture.edu.in',
    name: 'Anil Kumar',
    role: 'TEACHER',
  },
  'kavita.reddy@brightfuture.edu.in': {
    id: 'mock-kavita',
    email: 'kavita.reddy@brightfuture.edu.in',
    name: 'Kavita Reddy',
    role: 'TEACHER',
  },
  'suresh.iyer@brightfuture.edu.in': {
    id: 'mock-suresh',
    email: 'suresh.iyer@brightfuture.edu.in',
    name: 'Suresh Iyer',
    role: 'TEACHER',
  },
  'meena.joshi@brightfuture.edu.in': {
    id: 'mock-meena',
    email: 'meena.joshi@brightfuture.edu.in',
    name: 'Meena Joshi',
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
  if (!data?.token) {
    const err = new Error('Login succeeded but no session token was returned');
    err.status = 500;
    throw err;
  }
  setToken(data.token);
  setStoredUser(data.user);
  if (!getToken()) {
    const err = new Error('Could not save login session — check browser storage settings');
    err.status = 500;
    throw err;
  }
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
