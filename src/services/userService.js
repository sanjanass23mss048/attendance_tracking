import { apiFetch } from './api.js';

export function getUsers() {
  return apiFetch('/api/users');
}

export function createUser(body) {
  return apiFetch('/api/users', {
    method: 'POST',
    json: body,
  });
}
