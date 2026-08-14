import { useState } from 'react';
import { Eye, EyeOff, Lock, LogOut } from 'lucide-react';
import { changePassword, logout } from '../services/authService.js';
import { networkErrorMessage } from '../services/toast.js';
import attendanceLogoMark from '../assets/attendance-logo-mark.png';

export default function ChangePasswordPage({ user, onSuccess }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('All fields are required.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }
    if (currentPassword === newPassword) {
      setError('New password must be different from your current password.');
      return;
    }
    setLoading(true);
    try {
      await changePassword({ currentPassword, newPassword });
      onSuccess?.();
    } catch (err) {
      setError(networkErrorMessage(err) || 'Could not change password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f7f4ec] px-4">
      <div
        className="pointer-events-none absolute -left-[18%] -top-[35%] h-[78%] w-[78%] rounded-[50%] bg-[#1e3a8a] opacity-95"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-[32%] -right-[22%] h-[70%] w-[75%] rounded-[50%] bg-[#f5c542]"
        aria-hidden
      />

      <div className="relative z-10 w-full max-w-md rounded-2xl border border-white/60 bg-white/95 p-6 shadow-2xl backdrop-blur sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <img src={attendanceLogoMark} alt="" className="h-10 w-10 rounded-xl object-contain" />
          <div>
            <p className="text-sm font-semibold text-slate-900">Change password</p>
            <p className="text-xs text-slate-500">
              {user?.name || user?.email} — set a new password before continuing
            </p>
          </div>
        </div>

        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          You signed in with the default password. Choose a new password to continue.
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Current password</span>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-10 text-sm"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowCurrent((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
              >
                {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">New password</span>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-10 text-sm"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowNew((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
              >
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Confirm new password</span>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-10 text-sm"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </label>

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? 'Saving…' : 'Update password'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => logout()}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-700"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </div>
  );
}
