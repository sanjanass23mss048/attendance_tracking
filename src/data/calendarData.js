export const EVENT_TYPES = {
  working: {
    label: 'Working Day',
    dot: 'bg-green-500',
    chip: 'bg-emerald-50 text-emerald-800 border-emerald-100',
    cardIcon: 'bg-emerald-50 text-emerald-600',
  },
  holiday: {
    label: 'School Holiday',
    dot: 'bg-violet-500',
    chip: 'bg-violet-50 text-violet-800 border-violet-100',
    cardIcon: 'bg-violet-50 text-violet-600',
  },
  exam: {
    label: 'Exam',
    dot: 'bg-emerald-500',
    chip: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    cardIcon: 'bg-emerald-50 text-emerald-600',
  },
  event: {
    label: 'Event',
    dot: 'bg-sky-500',
    chip: 'bg-sky-50 text-sky-800 border-sky-100',
    cardIcon: 'bg-sky-50 text-sky-600',
  },
  important: {
    label: 'Important',
    dot: 'bg-amber-400',
    chip: 'bg-amber-50 text-amber-900 border-amber-200',
    cardIcon: 'bg-amber-50 text-amber-600',
  },
  sudden: {
    label: 'Sudden Holiday',
    dot: 'bg-violet-600',
    chip: 'bg-violet-100 text-violet-900 border-violet-200',
    cardIcon: 'bg-violet-100 text-violet-700',
  },
  other: {
    label: 'Others',
    dot: 'bg-slate-500',
    chip: 'bg-slate-50 text-slate-800 border-slate-200',
    cardIcon: 'bg-slate-50 text-slate-600',
  },
};

/** Demo school events shown on Academic Calendar (July 2026 mockup). */
export const JULY_2026_DEMO_EVENTS = [
  {
    id: 'jul-exam-1',
    date: '2026-07-08',
    type: 'exam',
    title: 'Unit Test 1',
    subtitle: 'All Day',
  },
  {
    id: 'jul-event-1',
    date: '2026-07-17',
    type: 'event',
    title: 'Science Expo',
    subtitle: '10:00 AM',
  },
  {
    id: 'jul-important-1',
    date: '2026-07-28',
    type: 'important',
    title: 'PTM Meeting',
    subtitle: '2:00 PM – 3:30 PM',
  },
];

export const MAY_2026_EVENTS = [
  { id: 'e1', day: 1, type: 'event', title: 'Lab Activity', subtitle: 'Class 3 - 5' },
  { id: 'e2', day: 8, type: 'exam', title: 'Unit Test - I', subtitle: 'Class 1 - 5' },
  { id: 'e3', day: 15, type: 'holiday', title: 'Summer Break Begins', subtitle: '' },
  { id: 'e4', day: 18, type: 'working', title: 'Book Fair', subtitle: 'All Classes' },
  { id: 'e5', day: 29, type: 'event', title: 'Annual Day Celebration', subtitle: '' },
];

export const SCHEDULED_EVENTS = [
  { id: 's1', date: '2026-05-15', type: 'holiday', title: 'Summer Break Begins' },
  { id: 's2', date: '2026-05-22', type: 'exam', title: 'Unit Test - I (Class 1-5)' },
  { id: 's3', date: '2026-05-29', type: 'event', title: 'Annual Day Celebration' },
  { id: 's4', date: '2026-07-08', type: 'exam', title: 'Unit Test 1' },
  { id: 's5', date: '2026-07-17', type: 'event', title: 'Science Expo' },
  { id: 's6', date: '2026-07-28', type: 'important', title: 'PTM Meeting' },
];

export const DEFAULT_SUDDEN_HOLIDAY = {
  date: '2026-05-12',
  reason: 'Heavy Rain',
  applicableTo: 'All Classes',
  message: '',
};

/** Build parent SMS/message from the sudden-holiday reason. */
export function buildSuddenHolidayMessage(reason) {
  const cleaned = String(reason || '').trim() || 'an unexpected reason';
  const lower = cleaned.toLowerCase();
  return `Dear Parent,\n\nDue to ${lower}, school will remain closed today. Attendance will not be marked for this date.`;
}

DEFAULT_SUDDEN_HOLIDAY.message = buildSuddenHolidayMessage(DEFAULT_SUDDEN_HOLIDAY.reason);

export const APPLICABLE_OPTIONS = [
  'All Classes',
  'Class 1 - 5',
  'Class 6 - 8',
  'Class 9 - 12',
];

export const CALENDAR_LEGEND = [
  { id: 'sunday', label: 'Weekly Holiday', color: 'bg-red-500' },
  { id: 'holiday', label: 'School Holiday', color: 'bg-violet-500' },
  { id: 'exam', label: 'Exam', color: 'bg-emerald-500' },
  { id: 'event', label: 'Event', color: 'bg-sky-500' },
  { id: 'important', label: 'Important', color: 'bg-amber-400' },
  { id: 'other', label: 'Others', color: 'bg-slate-500' },
];
