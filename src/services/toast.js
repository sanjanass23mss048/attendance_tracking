/** Lightweight toast bus — no React dependency so services can call it. */

/** @typedef {{ id: number, message: string, type: 'error'|'success'|'info' }} ToastItem */

/** @type {Set<(toast: ToastItem) => void>} */
const listeners = new Set();
let nextId = 1;

/**
 * @param {string} message
 * @param {'error'|'success'|'info'} [type]
 */
export function showToast(message, type = 'info') {
  const toast = { id: nextId++, message, type };
  listeners.forEach((fn) => fn(toast));
}

/**
 * @param {(toast: ToastItem) => void} listener
 * @returns {() => void}
 */
export function onToast(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Friendlier copy for network / API unreachable errors. */
export function networkErrorMessage(err) {
  const raw = err?.message || '';
  if (
    err?.isNetwork ||
    raw === 'Failed to fetch' ||
    raw.includes('NetworkError') ||
    raw.includes('fetch')
  ) {
    return 'Cannot reach server — is the API running on :4000?';
  }
  return raw || 'Something went wrong';
}
