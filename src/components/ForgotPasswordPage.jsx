import { useState } from 'react';
import { ArrowLeft, Mail } from 'lucide-react';
import { requestPasswordReset } from '../services/authService.js';
import { getRememberedEmail } from '../services/api.js';
import { networkErrorMessage } from '../services/toast.js';
import { SchoolLogo } from '../lib/branding.jsx';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState(getRememberedEmail() || '');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [resetLink, setResetLink] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setResetLink('');
    setLoading(true);
    try {
      const data = await requestPasswordReset(email.trim());
      setMessage(data?.message || 'If that email is registered, we sent a password reset link.');
      if (data?.resetLink) setResetLink(data.resetLink);
      setSent(true);
    } catch (err) {
      setError(networkErrorMessage(err) || 'Could not send reset email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen overflow-hidden bg-[#f7f4ec]">
      <div
        className="pointer-events-none absolute -left-[18%] -top-[35%] h-[78%] w-[78%] rounded-[50%] bg-[#1e3a8a] opacity-95 sm:-left-[12%] sm:-top-[28%] sm:h-[72%] sm:w-[58%]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-[32%] -right-[22%] h-[70%] w-[75%] rounded-[50%] bg-[#f5c542] sm:-bottom-[28%] sm:-right-[12%] sm:h-[68%] sm:w-[52%]"
        aria-hidden
      />

      <div className="absolute left-4 top-5 z-10 flex items-center gap-3 sm:left-8 sm:top-8">
        <SchoolLogo
          variant="mark"
          alt="School logo"
          className="h-12 w-12 rounded-xl bg-white/95 object-contain p-1 shadow-md ring-2 ring-white/30"
        />
        <span className="text-base font-semibold tracking-tight text-white drop-shadow-sm sm:text-lg">
          Presence
        </span>
      </div>

      <div className="relative z-20 flex min-h-screen w-full items-center justify-center px-4 py-16 sm:px-6">
        <div className="w-full max-w-[400px] rounded-2xl bg-white px-7 py-8 shadow-[0_20px_50px_-12px_rgba(30,58,138,0.28)] ring-1 ring-black/5 sm:px-9 sm:py-9">
          <div className="mb-6 text-center">
            <SchoolLogo
              variant="full"
              alt="School logo"
              className="mx-auto mb-2 h-24 w-auto max-w-[220px] object-contain"
            />
            <h1 className="text-lg font-semibold text-slate-900">Forgot your password?</h1>
            <p className="mt-1 text-sm text-slate-500">
              Enter your school account email and we will send a reset link.
            </p>
          </div>

          {message && (
            <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              {message}
            </div>
          )}
          {resetLink && (
            <p className="mb-4 break-all text-xs text-slate-600">
              Dev reset link:{' '}
              <a className="font-medium text-[#1e3a8a] underline" href={resetLink}>
                {resetLink}
              </a>
            </p>
          )}
          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="reset-email" className="mb-1.5 block text-xs font-medium text-slate-600">
                Email
              </label>
              <div className="relative">
                <Mail
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  size={16}
                />
                <input
                  id="reset-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={sent}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/80 py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#1e3a8a] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/20 disabled:opacity-60"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || sent}
              className="flex w-full items-center justify-center rounded-xl bg-[#1e3a8a] px-4 py-3 text-sm font-semibold text-white shadow-md shadow-[#1e3a8a]/25 transition hover:bg-[#172554] disabled:opacity-60"
            >
              {loading ? 'Sending…' : sent ? 'Link sent' : 'Send reset link'}
            </button>
          </form>

          <a
            href="/"
            className="mt-5 flex items-center justify-center gap-1.5 text-xs font-medium text-[#1e3a8a] hover:underline"
          >
            <ArrowLeft size={14} />
            Back to sign in
          </a>
        </div>
      </div>
    </div>
  );
}
