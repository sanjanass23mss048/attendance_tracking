import { io } from 'socket.io-client';
import { API_BASE, getToken, useMock } from './api.js';

/** @typedef {'live' | 'reconnecting' | 'offline'} ConnectionStatus */

/** @type {import('socket.io-client').Socket | null} */
let socket = null;

/** @type {Set<(status: ConnectionStatus) => void>} */
const statusListeners = new Set();

/** @type {Set<(payload: { sectionId: string, date: string, type: 'daily'|'periods' }) => void>} */
const attendanceListeners = new Set();

/** @type {ConnectionStatus} */
let currentStatus = 'offline';

function setStatus(status) {
  currentStatus = status;
  statusListeners.forEach((fn) => fn(status));
}

/**
 * Connect Socket.IO after login (no-op in mock mode).
 * @returns {import('socket.io-client').Socket | null}
 */
export function connectSocket() {
  if (useMock()) {
    setStatus('offline');
    return null;
  }

  if (socket?.connected) return socket;

  if (socket) {
    socket.connect();
    return socket;
  }

  const token = getToken();
  // Empty API_BASE → same origin (production / Vite proxy)
  socket = io(API_BASE || undefined, {
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    withCredentials: true,
    autoConnect: true,
    auth: token ? { token } : undefined,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 8000,
  });

  setStatus('reconnecting');

  socket.on('connect', () => setStatus('live'));
  socket.on('disconnect', () => setStatus('reconnecting'));
  socket.on('connect_error', () => setStatus('reconnecting'));
  socket.on('reconnect_attempt', () => setStatus('reconnecting'));
  socket.on('reconnect', () => setStatus('live'));
  socket.on('attendance:updated', (payload) => {
    attendanceListeners.forEach((fn) => {
      try {
        fn(payload);
      } catch (err) {
        console.error('attendance:updated handler error', err);
      }
    });
  });

  return socket;
}

export function disconnectSocket() {
  if (!socket) return;
  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
  setStatus('offline');
}

/** @returns {ConnectionStatus} */
export function getConnectionStatus() {
  return currentStatus;
}

/**
 * @param {(status: ConnectionStatus) => void} listener
 * @returns {() => void}
 */
export function onConnectionStatus(listener) {
  statusListeners.add(listener);
  listener(currentStatus);
  return () => statusListeners.delete(listener);
}

/**
 * @param {(payload: { sectionId: string, date: string, type: 'daily'|'periods' }) => void} listener
 * @returns {() => void}
 */
export function onAttendanceUpdated(listener) {
  attendanceListeners.add(listener);
  return () => attendanceListeners.delete(listener);
}
