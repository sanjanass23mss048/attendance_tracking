import { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Loader2,
  Lock,
  School,
  UserRound,
  X,
} from 'lucide-react';
import { checkSetupSlug, createSchool, getSetupMeta } from '../services/setupService.js';
import { networkErrorMessage } from '../services/toast.js';
import attendanceLogoMark from '../assets/attendance-logo-mark.png';

const STEPS = [
  { id: 0, title: 'School', description: 'Name, subdomain, and location' },
  { id: 1, title: 'Grades', description: 'Which classes to seed' },
  { id: 2, title: 'Admin', description: 'First administrator account' },
  { id: 3, title: 'Review', description: 'Confirm and create' },
];

function slugify(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

function querySecret() {
  try {
    return new URLSearchParams(window.location.search).get('secret') || '';
  } catch {
    return '';
  }
}

function inputClass() {
  return 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20';
}

export default function SchoolSetupPage() {
  const [step, setStep] = useState(0);
  const [meta, setMeta] = useState(null);
  const [setupSecret, setSetupSecret] = useState(querySecret);
  const [schoolName, setSchoolName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [city, setCity] = useState('');
  const [board, setBoard] = useState('');
  const [includeKg, setIncludeKg] = useState(true);
  const [maxGrade, setMaxGrade] = useState(12);
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPhone, setAdminPhone] = useState('');
  const [checkingSlug, setCheckingSlug] = useState(false);
  const [slugStatus, setSlugStatus] = useState(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState(null);

  const mainHost = meta?.mainHost || 'rioassetmanagement.info';
  const initialPassword = meta?.initialPassword || 'Initial1';
  const requiresSecret = Boolean(meta?.requiresSecret);

  useEffect(() => {
    let cancelled = false;
    getSetupMeta()
      .then((data) => {
        if (!cancelled) setMeta(data);
      })
      .catch(() => {
        if (!cancelled) {
          setMeta({
            requiresSecret: false,
            mainHost: 'rioassetmanagement.info',
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (slugTouched) return;
    const next = slugify(schoolName);
    setSlug(next);
  }, [schoolName, slugTouched]);

  useEffect(() => {
    if (!slug || slug.length < 3) {
      setSlugStatus(null);
      return undefined;
    }
    const t = setTimeout(async () => {
      setCheckingSlug(true);
      try {
        const result = await checkSetupSlug(slug, setupSecret || undefined);
        setSlugStatus(result);
        setError('');
      } catch (err) {
        setSlugStatus({ available: false, message: err.message || 'Could not check slug' });
      } finally {
        setCheckingSlug(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [slug, setupSecret]);

  const gradesPreview = useMemo(() => {
    const list = [];
    if (includeKg) list.push('LKG', 'UKG');
    const max = Math.min(12, Math.max(1, Number(maxGrade) || 12));
    for (let n = 1; n <= max; n += 1) list.push(String(n));
    return list;
  }, [includeKg, maxGrade]);

  const canNext = () => {
    if (step === 0) {
      if (requiresSecret && !String(setupSecret || '').trim()) return false;
      if (schoolName.trim().length < 2) return false;
      if (!slugStatus?.available) return false;
      return true;
    }
    if (step === 1) return Number(maxGrade) >= 1 && Number(maxGrade) <= 12;
    if (step === 2) {
      return Boolean(adminName.trim() && adminEmail.trim());
    }
    return true;
  };

  const goNext = () => {
    setError('');
    if (step < STEPS.length - 1) setStep((s) => s + 1);
  };

  const goBack = () => {
    setError('');
    if (step > 0) setStep((s) => s - 1);
  };

  const handleCreate = async () => {
    setError('');
    setCreating(true);
    try {
      const result = await createSchool({
        schoolName: schoolName.trim(),
        slug: slug.trim().toLowerCase(),
        city: city.trim() || undefined,
        board: board.trim() || undefined,
        includeKg,
        maxGrade: Number(maxGrade),
        setupSecret: setupSecret || undefined,
        admin: {
          name: adminName.trim(),
          email: adminEmail.trim(),
          phone: adminPhone.trim() || undefined,
        },
      });
      setCreated(result);
      const url = result.subdomainUrl;
      if (url) {
        window.setTimeout(() => {
          window.location.href = url;
        }, 4000);
      }
    } catch (err) {
      setError(networkErrorMessage(err) || err.message || 'Could not create school');
    } finally {
      setCreating(false);
    }
  };

  if (created) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f4ec] px-4">
        <div className="w-full max-w-lg rounded-2xl border border-emerald-100 bg-white p-8 text-center shadow-xl">
          <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-500" />
          <h1 className="mt-4 text-2xl font-bold text-slate-900">School ready</h1>
          <p className="mt-2 text-sm text-slate-600">
            {created.schoolName} is live. Sign in as{' '}
            <span className="font-semibold text-slate-800">{created.adminEmail}</span> with password{' '}
            <span className="font-semibold text-slate-800">{initialPassword}</span>.
          </p>
          <a
            href={created.subdomainUrl}
            className="mt-5 inline-flex items-center justify-center rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            {created.subdomainUrl?.replace(/^https?:\/\//, '')}
          </a>
          <p className="mt-3 text-xs text-slate-400">Redirecting in a few seconds…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f7f4ec]">
      <div
        className="pointer-events-none absolute -left-[18%] -top-[35%] h-[78%] w-[78%] rounded-[50%] bg-[#1e3a8a] opacity-95 sm:-left-[12%] sm:-top-[28%] sm:h-[72%] sm:w-[58%]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-[32%] -right-[22%] h-[70%] w-[75%] rounded-[50%] bg-[#f5c542] sm:-bottom-[28%] sm:-right-[12%] sm:h-[68%] sm:w-[52%]"
        aria-hidden
      />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-3xl flex-col px-4 py-8 sm:px-6">
        <div className="mb-6 flex items-center gap-3 text-white sm:mb-8">
          <img src={attendanceLogoMark} alt="" className="h-10 w-10 rounded-xl bg-white/10 object-contain p-1" />
          <div>
            <p className="text-sm font-semibold tracking-wide">Presence</p>
            <p className="text-xs text-white/70">Create a new school</p>
          </div>
        </div>

        <div className="rounded-2xl border border-white/60 bg-white/95 p-5 shadow-2xl backdrop-blur sm:p-8">
          <ol className="mb-6 grid grid-cols-4 gap-2">
            {STEPS.map((s) => {
              const active = s.id === step;
              const done = s.id < step;
              return (
                <li key={s.id} className="min-w-0">
                  <div
                    className={`flex items-center gap-2 rounded-xl px-2 py-2 text-xs font-semibold sm:px-3 ${
                      active
                        ? 'bg-indigo-600 text-white'
                        : done
                          ? 'bg-emerald-50 text-emerald-800'
                          : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/20 text-[10px]">
                      {done ? <Check className="h-3 w-3" /> : s.id + 1}
                    </span>
                    <span className="hidden truncate sm:inline">{s.title}</span>
                  </div>
                </li>
              );
            })}
          </ol>

          {step === 0 && (
            <div className="space-y-4">
              <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900">
                <School className="h-5 w-5 text-indigo-600" />
                School details
              </h1>
              {requiresSecret && (
                <label className="block">
                  <span className="mb-1 flex items-center gap-1 text-xs font-medium text-slate-600">
                    <Lock className="h-3.5 w-3.5" /> Setup secret
                  </span>
                  <input
                    type="password"
                    value={setupSecret}
                    onChange={(e) => setSetupSecret(e.target.value)}
                    className={inputClass()}
                    placeholder="Required to create a school"
                    autoComplete="off"
                  />
                </label>
              )}
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600">School name</span>
                <input
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  className={inputClass()}
                  placeholder="Sunrise Public School"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600">Subdomain slug</span>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    value={slug}
                    onChange={(e) => {
                      setSlugTouched(true);
                      setSlug(slugify(e.target.value));
                    }}
                    className={`${inputClass()} sm:max-w-[220px]`}
                    placeholder="sunrise"
                  />
                  <span className="truncate text-sm text-slate-500">.{mainHost}</span>
                </div>
                <p className="mt-1.5 min-h-[1.25rem] text-xs">
                  {checkingSlug ? (
                    <span className="inline-flex items-center gap-1 text-slate-500">
                      <Loader2 className="h-3 w-3 animate-spin" /> Checking…
                    </span>
                  ) : slugStatus?.available ? (
                    <span className="inline-flex items-center gap-1 text-emerald-700">
                      <Check className="h-3 w-3" /> {slugStatus.message}
                    </span>
                  ) : slugStatus ? (
                    <span className="inline-flex items-center gap-1 text-rose-600">
                      <X className="h-3 w-3" /> {slugStatus.message}
                    </span>
                  ) : (
                    <span className="text-slate-400">3–40 letters, numbers, or hyphens.</span>
                  )}
                </p>
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-600">City (optional)</span>
                  <input value={city} onChange={(e) => setCity(e.target.value)} className={inputClass()} />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-600">Board (optional)</span>
                  <input
                    value={board}
                    onChange={(e) => setBoard(e.target.value)}
                    className={inputClass()}
                    placeholder="CBSE, State, ICSE…"
                  />
                </label>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900">
                <GraduationCap className="h-5 w-5 text-indigo-600" />
                Grades to seed
              </h1>
              <p className="text-sm text-slate-600">
                Section <strong>A</strong> is created for each grade. Add more sections later on the Classes page.
                No student names are seeded.
              </p>
              <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <input
                  type="checkbox"
                  checked={includeKg}
                  onChange={(e) => setIncludeKg(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600"
                />
                <span>
                  <span className="block text-sm font-semibold text-slate-800">Include LKG and UKG</span>
                  <span className="text-xs text-slate-500">Uncheck if this school starts from Class 1.</span>
                </span>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600">Highest class (1–12)</span>
                <select
                  value={maxGrade}
                  onChange={(e) => setMaxGrade(Number(e.target.value))}
                  className={inputClass()}
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      Till class {n}
                    </option>
                  ))}
                </select>
              </label>
              <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
                <p className="font-semibold">Will create</p>
                <p className="mt-1 text-indigo-800">{gradesPreview.join(', ')} — section A</p>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900">
                <UserRound className="h-5 w-5 text-indigo-600" />
                School admin
              </h1>
              <p className="text-sm text-slate-600">
                This account signs in on the new subdomain with the Admin role.
              </p>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600">Full name</span>
                <input value={adminName} onChange={(e) => setAdminName(e.target.value)} className={inputClass()} />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600">Email</span>
                <input
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  className={inputClass()}
                  autoComplete="username"
                />
              </label>
              <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
                <p className="font-semibold">Default password</p>
                <p className="mt-1">
                  The admin signs in with <strong>{initialPassword}</strong> and will be prompted to change it on first
                  login.
                </p>
              </div>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600">Phone (optional)</span>
                <input value={adminPhone} onChange={(e) => setAdminPhone(e.target.value)} className={inputClass()} />
              </label>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900">
                <Building2 className="h-5 w-5 text-indigo-600" />
                Review
              </h1>
              <dl className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-slate-50">
                <ReviewRow label="School" value={schoolName} />
                <ReviewRow label="URL" value={`${slug}.${mainHost}`} />
                <ReviewRow label="Database" value={slugStatus?.databaseName || `${slug.replace(/-/g, '_')}_attdb`} />
                <ReviewRow label="City / board" value={[city, board].filter(Boolean).join(' · ') || '—'} />
                <ReviewRow label="Grades" value={`${gradesPreview.join(', ')} (section A)`} />
                <ReviewRow label="Admin" value={`${adminName} · ${adminEmail}`} />
                <ReviewRow label="Initial password" value={initialPassword} />
                <ReviewRow label="Roles seeded" value="Admin, Teacher, Parent" />
              </dl>
              <p className="text-xs text-slate-500">
                After create, open the school URL and add Teacher / Parent users from Users. Students can be imported later.
              </p>
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {error}
            </div>
          )}

          <div className="mt-6 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={goBack}
              disabled={step === 0 || creating}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" /> Back
            </button>
            {step < 3 ? (
              <button
                type="button"
                onClick={goNext}
                disabled={!canNext()}
                className="inline-flex items-center gap-1 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-40"
              >
                Next <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleCreate}
                disabled={creating || !canNext()}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-40"
              >
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {creating ? 'Creating school…' : 'Create school'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ReviewRow({ label, value }) {
  return (
    <div className="flex gap-4 px-4 py-3 text-sm">
      <dt className="w-28 shrink-0 font-medium text-slate-500">{label}</dt>
      <dd className="min-w-0 font-semibold text-slate-900">{value}</dd>
    </div>
  );
}
