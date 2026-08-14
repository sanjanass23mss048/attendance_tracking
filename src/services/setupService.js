import { apiFetch } from './api.js';

export function getSetupMeta() {
  return apiFetch('/api/setup/meta');
}

export function checkSetupSlug(slug, setupSecret) {
  return apiFetch('/api/setup/check-slug', {
    method: 'POST',
    json: { slug, setupSecret },
  });
}

export function createSchool(payload) {
  return apiFetch('/api/setup/create', {
    method: 'POST',
    json: payload,
  });
}
