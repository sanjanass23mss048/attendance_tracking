import { ArrowLeft, ChevronRight } from 'lucide-react';

export const PASTEL_CARDS = [
  { bg: 'bg-violet-50', border: 'border-violet-200', accent: 'text-violet-700', ring: 'ring-violet-200', bar: 'stroke-violet-500', chip: 'bg-violet-100 text-violet-800', edge: 'border-l-violet-500' },
  { bg: 'bg-sky-50', border: 'border-sky-200', accent: 'text-sky-700', ring: 'ring-sky-200', bar: 'stroke-sky-500', chip: 'bg-sky-100 text-sky-800', edge: 'border-l-sky-500' },
  { bg: 'bg-emerald-50', border: 'border-emerald-200', accent: 'text-emerald-700', ring: 'ring-emerald-200', bar: 'stroke-emerald-500', chip: 'bg-emerald-100 text-emerald-800', edge: 'border-l-emerald-500' },
  { bg: 'bg-amber-50', border: 'border-amber-200', accent: 'text-amber-800', ring: 'ring-amber-200', bar: 'stroke-amber-500', chip: 'bg-amber-100 text-amber-900', edge: 'border-l-amber-500' },
  { bg: 'bg-rose-50', border: 'border-rose-200', accent: 'text-rose-700', ring: 'ring-rose-200', bar: 'stroke-rose-500', chip: 'bg-rose-100 text-rose-800', edge: 'border-l-rose-500' },
  { bg: 'bg-indigo-50', border: 'border-indigo-200', accent: 'text-indigo-700', ring: 'ring-indigo-200', bar: 'stroke-indigo-500', chip: 'bg-indigo-100 text-indigo-800', edge: 'border-l-indigo-500' },
  { bg: 'bg-teal-50', border: 'border-teal-200', accent: 'text-teal-700', ring: 'ring-teal-200', bar: 'stroke-teal-500', chip: 'bg-teal-100 text-teal-800', edge: 'border-l-teal-500' },
  { bg: 'bg-fuchsia-50', border: 'border-fuchsia-200', accent: 'text-fuchsia-700', ring: 'ring-fuchsia-200', bar: 'stroke-fuchsia-500', chip: 'bg-fuchsia-100 text-fuchsia-800', edge: 'border-l-fuchsia-500' },
  { bg: 'bg-orange-50', border: 'border-orange-200', accent: 'text-orange-800', ring: 'ring-orange-200', bar: 'stroke-orange-500', chip: 'bg-orange-100 text-orange-900', edge: 'border-l-orange-500' },
  { bg: 'bg-cyan-50', border: 'border-cyan-200', accent: 'text-cyan-800', ring: 'ring-cyan-200', bar: 'stroke-cyan-500', chip: 'bg-cyan-100 text-cyan-900', edge: 'border-l-cyan-500' },
  { bg: 'bg-lime-50', border: 'border-lime-200', accent: 'text-lime-800', ring: 'ring-lime-200', bar: 'stroke-lime-500', chip: 'bg-lime-100 text-lime-900', edge: 'border-l-lime-500' },
  { bg: 'bg-blue-50', border: 'border-blue-200', accent: 'text-blue-700', ring: 'ring-blue-200', bar: 'stroke-blue-500', chip: 'bg-blue-100 text-blue-800', edge: 'border-l-blue-500' },
];

export function pastelAt(i) {
  return PASTEL_CARDS[Math.abs(i) % PASTEL_CARDS.length];
}

export function CircularAttendance({
  percent = 0,
  className = '',
  strokeClass = 'stroke-indigo-500',
  unmarked = false,
}) {
  const p = unmarked ? 0 : Math.max(0, Math.min(100, Number(percent) || 0));
  const r = 28;
  const c = 2 * Math.PI * r;
  const offset = c - (p / 100) * c;
  return (
    <div className={`relative h-16 w-16 shrink-0 ${className}`}>
      <svg viewBox="0 0 72 72" className="h-full w-full -rotate-90">
        <circle cx="36" cy="36" r={r} fill="none" strokeWidth="7" className="stroke-gray-200" />
        {!unmarked ? (
          <circle
            cx="36"
            cy="36"
            r={r}
            fill="none"
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
            className={strokeClass}
          />
        ) : null}
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-800">
        {unmarked ? '—' : `${p.toFixed(p % 1 ? 1 : 0)}%`}
      </span>
    </div>
  );
}

export function KpiCard({
  label,
  value,
  icon: Icon,
  tone = 'indigo',
  onClick,
  hint,
}) {
  const tones = {
    indigo: 'border-indigo-200 bg-indigo-50 text-indigo-700',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    red: 'border-rose-200 bg-rose-50 text-rose-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
    violet: 'border-violet-200 bg-violet-50 text-violet-700',
    sky: 'border-sky-200 bg-sky-50 text-sky-700',
    slate: 'border-gray-200 bg-white text-gray-700',
  };
  const iconTone = {
    indigo: 'bg-indigo-100 text-indigo-700',
    green: 'bg-emerald-100 text-emerald-700',
    red: 'bg-rose-100 text-rose-700',
    amber: 'bg-amber-100 text-amber-800',
    violet: 'bg-violet-100 text-violet-700',
    sky: 'bg-sky-100 text-sky-700',
    slate: 'bg-gray-100 text-gray-600',
  };
  const clickable = typeof onClick === 'function';
  const Comp = clickable ? 'button' : 'div';
  return (
    <Comp
      type={clickable ? 'button' : undefined}
      onClick={onClick}
      className={`rounded-2xl border p-4 text-left shadow-sm transition ${tones[tone] || tones.slate} ${
        clickable ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide opacity-80">{label}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
          {hint ? <p className="mt-1 text-[11px] font-medium opacity-70">{hint}</p> : null}
        </div>
        {Icon ? (
          <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconTone[tone] || iconTone.slate}`}>
            <Icon size={18} />
          </span>
        ) : null}
      </div>
    </Comp>
  );
}

export function ReportBreadcrumb({ items, onNavigate }) {
  return (
    <nav className="hidden flex-wrap items-center gap-1 text-sm text-gray-500 lg:flex">
      {items.map((item, i) => {
        const last = i === items.length - 1;
        return (
          <span key={`${item.label}-${i}`} className="inline-flex items-center gap-1">
            {i > 0 ? <ChevronRight size={14} className="text-gray-300" /> : null}
            {last || !item.path ? (
              <span className="font-semibold text-gray-800">{item.label}</span>
            ) : (
              <button
                type="button"
                onClick={() => onNavigate?.(item.path)}
                className="font-medium text-indigo-600 hover:underline"
              >
                {item.label}
              </button>
            )}
          </span>
        );
      })}
    </nav>
  );
}

export function ReportPageHeader({ title, subtitle, breadcrumb, onBack, onNavigate, actions }) {
  return (
    <div className="mb-5 space-y-3">
      {breadcrumb?.length ? (
        <ReportBreadcrumb items={breadcrumb} onNavigate={onNavigate} />
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {onBack ? (
              <button
                type="button"
                onClick={onBack}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 shadow-sm hover:bg-gray-50"
                aria-label="Back"
              >
                <ArrowLeft size={16} />
              </button>
            ) : null}
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-gray-900 sm:text-2xl">{title}</h2>
              {subtitle ? <p className="mt-0.5 hidden text-sm text-gray-500 lg:block">{subtitle}</p> : null}
            </div>
          </div>
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}

export function MobileKpi({
  label,
  value,
  icon: Icon,
  iconBg = 'bg-indigo-50',
  iconColor = 'text-indigo-600',
  cardBg = 'bg-white',
  hint,
  onClick,
}) {
  const clickable = typeof onClick === 'function';
  const Comp = clickable ? 'button' : 'div';
  return (
    <Comp
      type={clickable ? 'button' : undefined}
      onClick={onClick}
      className={`rounded-2xl border border-white/80 ${cardBg} p-3.5 text-left shadow-sm ${
        clickable ? 'active:scale-[0.99]' : ''
      }`}
    >
      {Icon ? (
        <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${iconBg}`}>
          <Icon size={18} className={iconColor} />
        </div>
      ) : null}
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="mt-0.5 text-xs font-medium text-gray-500">{label}</p>
      {hint ? <p className="mt-0.5 text-[11px] font-medium text-gray-400">{hint}</p> : null}
    </Comp>
  );
}

export function MobileStandardCard({
  title,
  subtitle,
  present,
  absent,
  percent,
  unmarked = false,
  tone,
  onClick,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-stretch overflow-hidden rounded-2xl border border-gray-100 bg-white text-left shadow-sm active:scale-[0.99] border-l-[5px] ${tone?.edge || 'border-l-[#1e3a8a]'}`}
    >
      <div className="min-w-0 flex-1 px-4 py-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className={`text-base font-bold ${tone?.accent || 'text-[#1e3a8a]'}`}>{title}</p>
            <p className="mt-0.5 text-xs font-medium text-gray-500">{subtitle}</p>
          </div>
          <CircularAttendance
            percent={percent}
            strokeClass={tone?.bar || 'stroke-[#1e3a8a]'}
            unmarked={unmarked}
          />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 border-t border-gray-100 pt-3 text-center">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">Present</p>
            <p className="mt-0.5 text-sm font-bold text-emerald-600">{present}</p>
          </div>
          <div className="border-x border-gray-100">
            <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">Absent</p>
            <p className="mt-0.5 text-sm font-bold text-rose-600">{absent}</p>
          </div>
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">Attendance</p>
            <p className={`mt-0.5 text-sm font-bold ${unmarked ? 'text-gray-400' : 'text-emerald-600'}`}>
              {unmarked ? 'Not marked' : `${percent}%`}
            </p>
          </div>
        </div>
      </div>
      <div className="flex items-center pr-2 text-gray-300">
        <ChevronRight size={20} />
      </div>
    </button>
  );
}

  const p = Number(percent) || 0;
  if (p >= 95) return { label: 'Excellent', className: 'bg-emerald-100 text-emerald-800' };
  if (p >= 85) return { label: 'Good', className: 'bg-sky-100 text-sky-800' };
  if (p >= 75) return { label: 'Average', className: 'bg-amber-100 text-amber-900' };
  return { label: 'Needs Attention', className: 'bg-rose-100 text-rose-800' };
}

export function formatShortDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(`${iso}T12:00:00`).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}
