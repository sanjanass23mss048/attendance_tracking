import {
  ALERT_CHANNELS,
  ALERT_RECIPIENTS,
} from '../components/AlertDeliveryOptions';
import { apiFetch } from './api.js';

const STORAGE_KEY = 'presence_alert_delivery_prefs_v3';

const DEFAULTS = {
  channel: ALERT_CHANNELS.SMS,
  recipient: ALERT_RECIPIENTS.FATHER,
};

function isValidChannel(value) {
  return Object.values(ALERT_CHANNELS).includes(value);
}

function isValidRecipient(value) {
  return Object.values(ALERT_RECIPIENTS).includes(value);
}

/** @returns {{ channel: string, recipient: string }} */
export function getAlertDeliveryPrefs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw);
    return {
      channel: isValidChannel(parsed?.channel) ? parsed.channel : DEFAULTS.channel,
      recipient: isValidRecipient(parsed?.recipient)
        ? parsed.recipient
        : DEFAULTS.recipient,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

/** @param {{ channel?: string, recipient?: string }} next */
export function setAlertDeliveryPrefs(next = {}) {
  const current = getAlertDeliveryPrefs();
  const prefs = {
    channel: isValidChannel(next.channel) ? next.channel : current.channel,
    recipient: isValidRecipient(next.recipient) ? next.recipient : current.recipient,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // ignore quota / private mode
  }
  return prefs;
}

/** Load school defaults into localStorage so send-alert uses them. */
export async function hydrateAlertDeliveryPrefs() {
  const data = await apiFetch('/api/settings/alert-delivery');
  if (!data?.configured) return getAlertDeliveryPrefs();
  return setAlertDeliveryPrefs(data);
}

export async function persistAlertDeliveryPrefs(next = {}) {
  const prefs = setAlertDeliveryPrefs(next);
  const data = await apiFetch('/api/settings/alert-delivery', {
    method: 'PUT',
    json: prefs,
  });
  return setAlertDeliveryPrefs(data);
}
