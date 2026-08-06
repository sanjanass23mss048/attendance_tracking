import { Users, UserCheck, UserX, BarChart2 } from 'lucide-react';

export default function StatsCards({ stats }) {
  const cards = [
    {
      label: 'Total Classes',
      value: stats.totalClasses ?? 0,
      icon: Users,
      iconBg: 'bg-indigo-100',
      iconColor: 'text-indigo-600',
    },
    {
      label: 'Present Today',
      value: stats.presentToday ?? 0,
      sub: `${stats.attendancePercent ?? 0}% of total`,
      icon: UserCheck,
      iconBg: 'bg-green-100',
      iconColor: 'text-green-600',
    },
    {
      label: 'Absent Today',
      value: stats.absentToday ?? 0,
      sub: `${100 - (stats.attendancePercent ?? 0)}% of total`,
      icon: UserX,
      iconBg: 'bg-red-100',
      iconColor: 'text-red-500',
    },
    {
      label: 'Attendance %',
      value: `${stats.attendancePercent ?? 0}%`,
      sub: 'Today',
      icon: BarChart2,
      iconBg: 'bg-amber-100',
      iconColor: 'text-amber-500',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="flex items-center gap-2.5 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm sm:gap-4 sm:rounded-xl sm:p-4"
        >
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl sm:h-12 sm:w-12 ${card.iconBg}`}
          >
            <card.icon size={20} className={`sm:hidden ${card.iconColor}`} />
            <card.icon size={22} className={`hidden sm:block ${card.iconColor}`} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-[10px] text-gray-500 sm:text-xs">{card.label}</p>
            <p className="text-xl font-bold leading-tight text-gray-900 sm:text-2xl">
              {card.value}
            </p>
            {card.sub && (
              <p className="truncate text-[10px] text-gray-400 sm:text-xs">{card.sub}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
