import { ATTENDANCE_STATUS } from '../data/mockData';
import { normalizeStatus } from '../utils/attendance';

export default function StatusBadge({ status, size = 'md' }) {
  const code = normalizeStatus(status);
  const config = ATTENDANCE_STATUS[code];
  if (!config) return <span className="inline-block h-7 w-7" />;

  const sizeClass =
    size === 'sm'
      ? 'h-6 min-w-6 px-0.5 text-[10px]'
      : 'h-7 min-w-7 px-0.5 text-xs';

  return (
    <span
      className={`inline-flex items-center justify-center rounded-md font-bold ${sizeClass} ${config.color} ${config.text}`}
      title={config.label}
    >
      {code}
    </span>
  );
}
