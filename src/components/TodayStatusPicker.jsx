import { ATTENDANCE_STATUS } from '../data/mockData';

export default function TodayStatusPicker({ status, onChange, disabled = false }) {
  return (
    <div className="flex items-center justify-center gap-1">
      {Object.entries(ATTENDANCE_STATUS).map(([key, val]) => {
        const isActive = status === key;
        return (
          <button
            key={key}
            type="button"
            disabled={disabled}
            onClick={() => onChange(key)}
            title={val.label}
            className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold transition-all ${
              isActive
                ? `${val.color} ${val.text} ring-2 ring-indigo-400 ring-offset-1 scale-110 shadow-md`
                : 'bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-600 hover:scale-105'
            } ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
          >
            {key}
          </button>
        );
      })}
    </div>
  );
}
