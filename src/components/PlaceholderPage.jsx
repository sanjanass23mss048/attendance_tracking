import {
  LayoutDashboard,
  CalendarRange,
  Users,
  BookOpen,
  MessageSquare,
  Settings,
  Bell,
} from 'lucide-react';

const PAGE_CONFIG = {
  dashboard: {
    icon: LayoutDashboard,
    title: 'Dashboard',
    subtitle: 'School overview and quick stats',
    description: 'View school-wide metrics, recent activity, and shortcuts to key tasks.',
    items: ['Total enrollment: 1,240 students', '24 active classes', '86% attendance today', '12 pending messages'],
  },
  daywise: {
    icon: CalendarRange,
    title: 'Day-wise Attendance',
    subtitle: 'Review attendance by date across classes',
    description: 'Pick a date to see present, absent, and leave totals for every class and section.',
    items: ['Browse by calendar date', 'Class-wise daily summary', 'Compare sections side by side', 'Export day sheet'],
  },
  students: {
    icon: Users,
    title: 'Students',
    subtitle: 'Manage student records',
    description: 'Browse, add, and edit student profiles across all classes.',
    items: ['1,240 registered students', '28 students in Class 1-A', 'Search by name or roll number', 'Export student list'],
  },
  classes: {
    icon: BookOpen,
    title: 'Classes',
    subtitle: 'Class and section management',
    description: 'Organize classes, sections, and assign class teachers.',
    items: ['24 classes across 5 grades', 'Sections A, B, C per class', 'Class teacher assignments', 'Timetable links'],
  },
  messages: {
    icon: MessageSquare,
    title: 'Messages',
    subtitle: 'Parent communication',
    description: 'Send and track SMS/notifications to parents.',
    items: ['68 messages sent today', 'Absent alerts queued', 'Message templates', 'Delivery status'],
  },
  settings: {
    icon: Settings,
    title: 'Settings',
    subtitle: 'System configuration',
    description: 'Configure school profile, users, and attendance rules.',
    items: ['School profile', 'User roles & permissions', 'Attendance rules', 'Notification settings'],
  },
  notifications: {
    icon: Bell,
    title: 'Notifications',
    subtitle: 'Alerts and school announcements',
    description: 'View attendance alerts, holiday notices, and system messages.',
    items: ['Unread alerts', 'Holiday notices', 'Attendance reminders', 'System updates'],
  },
};

export default function PlaceholderPage({ pageId, items: itemsOverride }) {
  const config = PAGE_CONFIG[pageId];
  if (!config) return null;

  const Icon = config.icon;
  const items = itemsOverride || config.items;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
      <div className="mb-6 flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-indigo-100">
          <Icon size={28} className="text-indigo-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{config.title}</h2>
          <p className="text-sm text-gray-500">{config.subtitle}</p>
        </div>
      </div>

      <p className="mb-6 text-gray-600">{config.description}</p>

      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <div
            key={item}
            className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-700"
          >
            {item}
          </div>
        ))}
      </div>

      <p className="mt-6 text-xs text-gray-400">
        {pageId === 'dashboard'
          ? 'Stats above are loaded from today’s attendance marks in the API.'
          : `This section is a preview. Full ${config.title.toLowerCase()} module coming soon.`}
      </p>
    </div>
  );
}
