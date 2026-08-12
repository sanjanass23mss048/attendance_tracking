import { useState } from 'react';
import { LogOut, Settings as SettingsIcon } from 'lucide-react';
import AlertDeliveryOptions from './AlertDeliveryOptions';
import {
  getAlertDeliveryPrefs,
  setAlertDeliveryPrefs,
} from '../services/alertDeliveryPrefs';
import { showToast } from '../services/toast';

const ROLE_LABELS = {
  INCHARGE: 'Attendance In-charge',
  TEACHER: 'Teacher',
  ADMIN: 'Administrator',
};

export default function SettingsPage({ user, onLogout }) {
  const initials = (user?.name || '?')
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const [prefs, setPrefs] = useState(() => getAlertDeliveryPrefs());

  const updatePrefs = (partial) => {
    const next = setAlertDeliveryPrefs({ ...prefs, ...partial });
    setPrefs(next);
    showToast('Alert preferences saved', 'success');
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100">
            <SettingsIcon size={20} className="text-indigo-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Settings</h2>
            <p className="text-sm text-gray-500">Account and notification preferences</p>
          </div>
        </div>

        <div className="mb-6 flex items-center gap-4 rounded-xl border border-gray-100 bg-gray-50 p-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">
            {initials}
          </div>
          <div>
            <p className="text-base font-semibold text-gray-900">{user?.name || '—'}</p>
            <p className="text-sm text-gray-500">{user?.email}</p>
            <p className="text-xs text-indigo-600">
              {ROLE_LABELS[user?.role] || user?.role || 'User'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onLogout}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-100"
        >
          <LogOut size={16} />
          Log out
        </button>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="text-base font-bold text-gray-900">Absence alert delivery</h3>
        <p className="mb-5 mt-1 text-sm text-gray-500">
          These defaults are used when sending parent absence alerts from Attendance.
        </p>
        <AlertDeliveryOptions
          channel={prefs.channel}
          recipient={prefs.recipient}
          onChannelChange={(channel) => updatePrefs({ channel })}
          onRecipientChange={(recipient) => updatePrefs({ recipient })}
        />
      </div>
    </div>
  );
}
