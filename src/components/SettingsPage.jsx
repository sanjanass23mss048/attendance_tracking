import { useEffect, useState } from 'react';
import { ImagePlus, LogOut, Settings as SettingsIcon } from 'lucide-react';
import AlertDeliveryOptions from './AlertDeliveryOptions';
import {
  getAlertDeliveryPrefs,
  hydrateAlertDeliveryPrefs,
  persistAlertDeliveryPrefs,
} from '../services/alertDeliveryPrefs';
import { showToast } from '../services/toast';
import { uploadSchoolLogo, useBranding } from '../lib/branding.jsx';
import { canManageUsers } from '../data/navItems.js';

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
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const { markSrc, refresh } = useBranding();
  const canEditLogo = canManageUsers(user);

  useEffect(() => {
    let cancelled = false;
    hydrateAlertDeliveryPrefs()
      .then((next) => {
        if (!cancelled) setPrefs(next);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const updatePrefs = async (partial) => {
    const next = { ...prefs, ...partial };
    setPrefs(next);
    try {
      const saved = await persistAlertDeliveryPrefs(next);
      setPrefs(saved);
      showToast('Alert preferences saved', 'success');
    } catch (err) {
      showToast(err.message || 'Could not save alert preferences', 'error');
    }
  };

  const onLogoChosen = async (file) => {
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
      showToast('School logo must be a PNG, JPEG, or WebP image.', 'error');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      showToast('School logo must be 2 MB or smaller.', 'error');
      return;
    }
    setUploadingLogo(true);
    try {
      await uploadSchoolLogo(file);
      await refresh();
      showToast('School logo updated', 'success');
    } catch (err) {
      showToast(err.message || 'Could not upload school logo.', 'error');
    } finally {
      setUploadingLogo(false);
    }
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

        {canEditLogo && (
          <div className="mb-6 flex items-center gap-4 rounded-xl border border-gray-100 bg-gray-50 p-4">
            <img src={markSrc} alt="" className="h-16 w-16 rounded-xl bg-white object-contain p-1 ring-1 ring-gray-200" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-900">School logo</p>
              <p className="text-xs text-gray-500">Shown on login, sidebar, and reports. PNG, JPEG, or WebP up to 2 MB.</p>
              <input
                id="settings-logo-upload"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  onLogoChosen(file);
                }}
              />
              <label
                htmlFor="settings-logo-upload"
                className={`mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 ${
                  uploadingLogo ? 'pointer-events-none opacity-60' : ''
                }`}
              >
                <ImagePlus size={14} />
                {uploadingLogo ? 'Uploading…' : 'Upload school logo'}
              </label>
            </div>
          </div>
        )}

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
