import {
  Menu,
  Bell,
  LayoutDashboard,
  ClipboardCheck,
  User,
} from 'lucide-react';

const EMPTY_STATS = {
  presentToday: 0,
  absentToday: 0,
  lateToday: 0,
  halfDayToday: 0,
  odHalfDayToday: 0,
  odFullDayToday: 0,
};

/**
 * Compact mobile preview. Stats and class list must come from the live API
 * (pass dashStats + classes from App) — no hard-coded demo numbers.
 */
export default function MobileAttendanceView({
  activeClassId,
  classLabel,
  classPercent,
  onSelectClass,
  onMarkAttendance,
  studentsLoaded,
  stats = EMPTY_STATS,
  classes = [],
}) {
  const summary = [
    { key: 'P', count: stats.presentToday ?? 0, color: 'bg-green-500' },
    { key: 'A', count: stats.absentToday ?? 0, color: 'bg-red-500' },
    { key: 'L', count: stats.lateToday ?? 0, color: 'bg-amber-400' },
    { key: 'H', count: stats.halfDayToday ?? 0, color: 'bg-violet-500' },
    { key: 'OH', count: stats.odHalfDayToday ?? 0, color: 'bg-cyan-500' },
    { key: 'OF', count: stats.odFullDayToday ?? 0, color: 'bg-teal-700' },
  ];

  return (
    <div className="mx-auto w-full max-w-[390px] overflow-hidden rounded-[2rem] border-4 border-gray-800 bg-white shadow-2xl">
      <div className="bg-indigo-700 px-4 py-3 text-white">
        <div className="flex items-center justify-between">
          <button type="button" className="rounded-lg p-1 hover:bg-indigo-600">
            <Menu size={22} />
          </button>
          <h1 className="text-base font-bold">Attendance</h1>
          <button type="button" className="relative rounded-lg p-1 hover:bg-indigo-600">
            <Bell size={20} />
          </button>
        </div>
      </div>

      <div className="bg-gray-50 px-4 py-3">
        <div className="flex justify-between gap-2">
          {summary.map((item) => (
            <div
              key={item.key}
              className="flex flex-1 flex-col items-center rounded-xl bg-white p-2 shadow-sm"
            >
              <span
                className={`mb-1 flex h-7 min-w-7 items-center justify-center rounded-md px-0.5 text-[10px] font-bold text-white ${item.color}`}
              >
                {item.key}
              </span>
              <span className="text-sm font-bold text-gray-800">{item.count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 py-3">
        <h2 className="mb-3 text-sm font-bold text-gray-900">Today&apos;s Classes</h2>
        {classes.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-200 bg-white px-3 py-6 text-center text-xs text-gray-500">
            No classes loaded from the API yet.
          </p>
        ) : (
          <div className="space-y-2">
            {classes.map((cls) => {
              const isActive = cls.id === activeClassId;
              return (
                <div
                  key={cls.id}
                  className={`flex items-center justify-between rounded-xl border px-3 py-3 ${
                    isActive ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-white'
                  }`}
                >
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{cls.label}</p>
                    <p className="text-xs text-gray-500">
                      {cls.students ?? 0} students
                      {isActive ? ` · ${classPercent}%` : ''}
                    </p>
                  </div>
                  {isActive ? (
                    <span className="rounded-md bg-amber-400 px-2.5 py-1 text-xs font-bold text-gray-900">
                      Active
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onSelectClass(cls.classNum, cls.section)}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                    >
                      Mark
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="px-4 pb-3">
        <p className="mb-2 text-center text-xs text-gray-500">
          {studentsLoaded ? `Marking: ${classLabel}` : 'Select a class to mark attendance'}
        </p>
        <button
          type="button"
          onClick={onMarkAttendance}
          className="w-full rounded-xl bg-indigo-600 py-3.5 text-sm font-bold text-white shadow-sm hover:bg-indigo-700"
        >
          Mark Attendance
        </button>
      </div>

      <div className="flex items-center justify-around border-t border-gray-200 bg-white px-2 py-2">
        {[
          { icon: LayoutDashboard, label: 'Dashboard', active: false },
          { icon: ClipboardCheck, label: 'Attendance', active: true },
          { icon: User, label: 'Profile', active: false },
        ].map(({ icon: Icon, label, active }) => (
          <button
            key={label}
            type="button"
            className={`flex flex-col items-center gap-0.5 px-3 py-1 text-[10px] font-medium ${
              active ? 'text-indigo-600' : 'text-gray-400'
            }`}
          >
            <Icon size={20} />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
