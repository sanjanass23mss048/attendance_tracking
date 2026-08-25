import { useState } from 'react';
import {
  Shield,
  LogIn,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Calendar,
  Users,
  ClipboardList,
  GraduationCap,
  BookOpen,
  Backpack,
} from 'lucide-react';
import { login } from '../services/authService.js';
import { getRememberedEmail } from '../services/api.js';
import { isApexBrowserHost } from '../lib/tenantHost.js';
import { networkErrorMessage } from '../services/toast.js';
import { SchoolLogo, useBranding } from '../lib/branding.jsx';

const SCHOOL_IMAGE =
  'https://images.unsplash.com/photo-1562774053-701939374585?auto=format&fit=crop&w=1200&q=80';

const DEFAULT_EMAIL = 'incharge@brightfuture.edu.in';

export default function LoginPage({ onSuccess }) {
  const { schoolName, hasLogo } = useBranding();
  const onApex = isApexBrowserHost();
  const brandLabel = onApex
    ? 'Presence'
    : String(schoolName || '').trim() || 'School Attendance';
  const remembered = getRememberedEmail();
  const [email, setEmail] = useState(remembered || (onApex ? DEFAULT_EMAIL : ''));
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await login({
        email: email.trim(),
        password,
        rememberMe,
      });
      onSuccess?.(data);
    } catch (err) {
      setError(networkErrorMessage(err) || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen overflow-hidden bg-[#f7f4ec]">
      {/* Deep blue curved atmosphere — top left */}
      <div
        className="pointer-events-none absolute -left-[18%] -top-[35%] h-[78%] w-[78%] rounded-[50%] bg-[#1e3a8a] opacity-95 sm:-left-[12%] sm:-top-[28%] sm:h-[72%] sm:w-[58%]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -left-[8%] -top-[18%] h-[55%] w-[55%] rounded-[50%] bg-[#1e40af]/40 blur-2xl sm:w-[42%]"
        aria-hidden
      />

      {/* Yellow curved atmosphere — bottom right */}
      <div
        className="pointer-events-none absolute -bottom-[32%] -right-[22%] h-[70%] w-[75%] rounded-[50%] bg-[#f5c542] sm:-bottom-[28%] sm:-right-[12%] sm:h-[68%] sm:w-[52%]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-[10%] -right-[5%] h-[40%] w-[40%] rounded-[50%] bg-[#fbbf24]/50 blur-xl"
        aria-hidden
      />

      {/* App branding in blue zone */}
      <div className="absolute left-4 top-5 z-10 flex items-center gap-3 sm:left-8 sm:top-8">
        <SchoolLogo
          variant="mark"
          alt={brandLabel}
          className="h-12 w-12 rounded-xl bg-white/95 object-contain p-1 shadow-md ring-2 ring-white/30 sm:h-14 sm:w-14"
        />
        <span className="text-base font-semibold tracking-tight text-white drop-shadow-sm sm:text-lg">
          {brandLabel}
        </span>
      </div>

      {/* Left school photo panel */}
      <div className="absolute bottom-8 left-6 top-28 z-10 hidden w-[34%] max-w-md overflow-hidden rounded-3xl shadow-2xl ring-1 ring-white/20 lg:block xl:left-10 xl:w-[36%]">
        <img
          src={SCHOOL_IMAGE}
          alt="Bright Future Public School campus"
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#1e3a8a]/70 via-transparent to-[#1e3a8a]/25" />
        <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
          <p className="text-sm font-semibold tracking-wide">Campus &amp; community</p>
          <p className="mt-1 text-xs text-white/80">Where every attendance builds a brighter day</p>
        </div>
      </div>

      {/* Decorative icons + dashed path (right side) */}
      <svg
        className="pointer-events-none absolute right-[6%] top-[18%] z-[1] hidden h-[42%] w-40 text-[#1e3a8a]/25 xl:block"
        viewBox="0 0 160 420"
        fill="none"
        aria-hidden
      >
        <path
          d="M80 28 C 40 90, 120 140, 80 200 C 40 260, 120 310, 80 380"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeDasharray="6 8"
        />
      </svg>
      <div
        className="pointer-events-none absolute right-[8%] top-[16%] z-[1] hidden flex-col items-center gap-14 text-[#1e3a8a]/30 xl:flex"
        aria-hidden
      >
        <Calendar size={28} strokeWidth={1.4} />
        <Users size={28} strokeWidth={1.4} />
        <ClipboardList size={28} strokeWidth={1.4} />
        <GraduationCap size={30} strokeWidth={1.4} />
      </div>

      {/* Backpack / books line art on yellow zone */}
      <div
        className="pointer-events-none absolute bottom-10 right-8 z-[1] hidden items-end gap-4 text-[#1e3a8a]/25 sm:flex md:right-16 md:bottom-14"
        aria-hidden
      >
        <BookOpen size={48} strokeWidth={1.15} />
        <Backpack size={56} strokeWidth={1.15} />
      </div>

      {/* Centered login card */}
      <div className="relative z-20 flex min-h-screen w-full items-center justify-center px-4 py-16 sm:px-6">
        <div className="w-full max-w-[400px] rounded-2xl bg-white px-7 py-8 shadow-[0_20px_50px_-12px_rgba(30,58,138,0.28)] ring-1 ring-black/5 sm:px-9 sm:py-9">
          <div className="mb-7 text-center">
            <SchoolLogo
              variant="full"
              alt={brandLabel}
              className="mx-auto mb-2 h-28 w-auto max-w-[240px] object-contain sm:h-32 sm:max-w-[280px]"
            />
            {!onApex && brandLabel ? (
              <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{brandLabel}</h1>
            ) : null}
            <p className={`text-sm text-slate-500 ${!onApex && brandLabel ? 'mt-1' : 'mt-1'}`}>
              Sign in to continue
            </p>
            {!onApex && !hasLogo ? (
              <p className="mt-2 text-xs text-slate-400">
                Upload your school logo in Settings after signing in.
              </p>
            ) : null}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-xs font-medium text-slate-600">
                Email
              </label>
              <div className="relative">
                <Mail
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  size={16}
                />
                <input
                  id="email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/80 py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#1e3a8a] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/20"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-xs font-medium text-slate-600">
                Password
              </label>
              <div className="relative">
                <Lock
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  size={16}
                />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="login-password-input w-full rounded-xl border border-slate-200 bg-slate-50/80 py-2.5 pl-10 pr-11 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#1e3a8a] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-slate-400 hover:text-slate-600"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-0.5">
              <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-[#1e3a8a] focus:ring-[#1e3a8a]"
                />
                Remember me
              </label>
              <a
                href="/forgot-password"
                className="text-xs font-medium text-[#1e3a8a] hover:underline"
              >
                Forgot password?
              </a>
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1e3a8a] px-4 py-3 text-sm font-semibold text-white shadow-md shadow-[#1e3a8a]/25 transition hover:bg-[#172554] disabled:opacity-60"
            >
              <LogIn size={17} />
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <div className="mt-7 flex items-center justify-center gap-2 border-t border-slate-100 pt-5 text-xs text-slate-500">
            <Shield className="text-[#1e3a8a]/70" size={14} />
            <p>
              School attendance, securely managed.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
