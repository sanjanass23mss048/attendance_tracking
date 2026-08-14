import { apiFetch } from './api.js';

export async function getAppSettings() {
  return apiFetch('/api/settings');
}

export async function saveAppSettings(values) {
  return apiFetch('/api/settings', {
    method: 'PUT',
    json: { values },
  });
}
