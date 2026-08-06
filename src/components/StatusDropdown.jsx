import { ChevronDown } from 'lucide-react';
import { ATTENDANCE_STATUS } from '../data/mockData';

const statusStyles = {
  P: 'bg-green-500 text-white border-green-500',
  A: 'bg-red-500 text-white border-red-500',
  L: 'bg-amber-400 text-gray-900 border-amber-400',
  H: 'bg-violet-500 text-white border-violet-500',
  OH: 'bg-cyan-500 text-white border-cyan-500',
  OF: 'bg-teal-700 text-white border-teal-700',
};

export default function StatusDropdown({ status, onChange, disabled = false }) {
  const normalized = status === 'O' ? 'OF' : status;
  const display = ATTENDANCE_STATUS[normalized] || ATTENDANCE_STATUS.P;
  const styleKey = ATTENDANCE_STATUS[normalized] ? normalized : 'P';

  return (
    <div className="relative">
      <select
        value={ATTENDANCE_STATUS[normalized] ? normalized : 'P'}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full appearance-none rounded-lg border px-3 py-2 pr-8 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:cursor-not-allowed disabled:opacity-60 ${statusStyles[styleKey]}`}
      >
        {Object.entries(ATTENDANCE_STATUS).map(([key, val]) => (
          <option key={key} value={key} className="bg-white text-gray-800">
            {key} — {val.label}
          </option>
        ))}
      </select>
      <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-white/90" />
      <span className="sr-only">{display.label}</span>
    </div>
  );
}
