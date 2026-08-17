import { useEffect, useState } from 'react';
import { ImagePlus, Loader2, LogOut, Save, Settings as SettingsIcon } from 'lucide-react';
import AlertDeliveryOptions from './AlertDeliveryOptions';
import {
  getAlertDeliveryPrefs,
  setAlertDeliveryPrefs,
} from '../services/alertDeliveryPrefs';
import { getAppSettings, saveAppSettings } from '../services/appSettingsService';
import { showToast } from '../services/toast';
import { uploadSchoolLogo, useBranding } from '../lib/branding.jsx';
import { canManageUsers } from '../data/navItems.js';

const ROLE_LABELS = {
  INCHARGE: 'Attendance In-charge',
  TEACHER: 'Teacher',
  ADMIN: 'Administrator',
};

const SETTINGS_ROLES = new Set(['ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'HEADMASTER', 'INCHARGE']);

function IntegrationSettings() {
  const [groups, setGroups] = useState([]);
  const [draft, setDraft] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getAppSettings();
        if (!cancelled) setGroups(data.groups || []);
      } catch (err) {
        if (!cancelled) showToast(err.message || 'Could not load integration settings', 'error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const data = await saveAppSettings(draft);
      setGroups(data.groups || []);
      setDraft({});
      showToast('Settings saved to the database', 'success');
    } catch (err) {
      showToast(err.message || 'Could not save settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Loader2 size={16} className="animate-spin" />
        Loading integration settings…
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {groups.map((group) => (
        <div key={group.id} className="space-y-3">
          <div>
            <h4 className="text-sm font-semibold text-gray-900">{group.label}</h4>
            {group.description ? (
              <p className="mt-0.5 text-xs text-gray-500">{group.description}</p>
            ) : null}
          </div>
          <div className="grid gap-3">
            {group.fields.map((field) => (
              <label key={field.key} className="block">
                <span className="mb-1 block text-xs font-medium text-gray-600">{field.label}</span>
                {field.multiline ? (
                  <textarea
                    rows={4}
                    value={draft[field.key] ?? field.value}
                    placeholder={field.secret ? field.preview || 'Leave blank to keep current' : field.hint}
                    onChange={(e) => setDraft((prev) => ({ ...prev, [field.key]: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 font-mono text-sm focus:border-indigo-500 focus:outline-none"
                  />
                ) : (
                  <input
                    type={field.secret ? 'password' : 'text'}
                    autoComplete="off"
                    value={draft[field.key] ?? field.value}
                    placeholder={field.secret ? field.preview || 'Leave blank to keep current' : field.hint}
                    onChange={(e) => setDraft((prev) => ({ ...prev, [field.key]: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  />
                )}
                {field.secret && field.configured ? (
                  <span className="mt-1 block text-xs text-emerald-700">Saved in DB {field.preview}</span>
                ) : field.hint && !field.secret ? (
                  <span className="mt-1 block text-xs text-gray-400">{field.hint}</span>
                ) : null}
              </label>
            ))}
          </div>
        </div>
      ))}
      <button
        type="submit"
        disabled={saving}
        className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
        Save to database
      </button>
    </form>
  );
}

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

  const updatePrefs = (partial) => {
    const next = setAlertDeliveryPrefs({ ...prefs, ...partial });
    setPrefs(next);
    showToast('Alert preferences saved', 'success');
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
          WhatsApp needs the Cloud API token, phone number ID, and the matching
          approved template names saved below (attendance_alert, sudden_holiday, login_otp,
          promotion_message).
        </p>
        <AlertDeliveryOptions
          channel={prefs.channel}
          recipient={prefs.recipient}
          onChannelChange={(channel) => updatePrefs({ channel })}
          onRecipientChange={(recipient) => updatePrefs({ recipient })}
        />
      </div>

      {SETTINGS_ROLES.has(String(user?.role || '').toUpperCase()) ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-base font-bold text-gray-900">SMS, WhatsApp &amp; push</h3>
          <p className="mb-5 mt-1 text-sm text-gray-500">
            Values are stored in this school’s database (<span className="font-medium">tblApp_Settings</span>
            ). SMS and WhatsApp use these rows on every send — not a local .env file.
          </p>
          <IntegrationSettings />
        </div>
      ) : null}
    </div>
  );
}
