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

export function createSchool(payload, logoFile) {
  if (logoFile) {
    const form = new FormData();
    form.append('data', JSON.stringify(payload));
    form.append('logo', logoFile);
    return apiFetch('/api/setup/create', { method: 'POST', body: form });
  }
  return apiFetch('/api/setup/create', {
    method: 'POST',
    json: payload,
  });
}
