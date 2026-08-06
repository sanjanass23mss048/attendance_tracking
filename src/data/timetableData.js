/** Weekly timetable demo data. Grid is [periodIndex][dayIndex]; UI shows periods as columns, days as rows. */

export const TIMETABLE_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const PERIOD_TIMES = [
  { period: 1, time: '08:00 AM - 08:40 AM' },
  { period: 2, time: '08:40 AM - 09:20 AM' },
  { period: 3, time: '09:20 AM - 10:00 AM' },
  { period: 4, time: '10:20 AM - 11:00 AM' },
  { period: 5, time: '11:00 AM - 11:40 AM' },
  { period: 6, time: '11:40 AM - 12:20 PM' },
  { period: 7, time: '01:00 PM - 01:40 PM' },
  { period: 8, time: '01:40 PM - 02:20 PM' },
];

export const SUBJECT_STYLES = {
  English: 'bg-sky-100 text-sky-900 border-sky-200',
  Maths: 'bg-violet-100 text-violet-900 border-violet-200',
  EVS: 'bg-emerald-100 text-emerald-900 border-emerald-200',
  Hindi: 'bg-rose-100 text-rose-900 border-rose-200',
  Computer: 'bg-orange-100 text-orange-900 border-orange-200',
  Drawing: 'bg-amber-100 text-amber-900 border-amber-200',
  Games: 'bg-lime-100 text-lime-900 border-lime-200',
  Library: 'bg-yellow-100 text-yellow-900 border-yellow-200',
  Science: 'bg-teal-100 text-teal-900 border-teal-200',
  Social: 'bg-indigo-100 text-indigo-900 border-indigo-200',
};

function cell(subject, teacher) {
  return { subject, teacher };
}

/** Default Class 1-A style weekly grid: [periodIndex][dayIndex] */
export function buildDefaultWeeklyTimetable() {
  const pattern = [
    // P1
    [cell('English', 'Neha Sharma'), cell('Maths', 'Rakesh Verma'), cell('EVS', 'Priya Nair'), cell('Hindi', 'Anita Desai'), cell('English', 'Neha Sharma'), cell('Games', 'Vikram Singh')],
    // P2
    [cell('Maths', 'Rakesh Verma'), cell('English', 'Neha Sharma'), cell('Maths', 'Rakesh Verma'), cell('EVS', 'Priya Nair'), cell('Computer', 'Sonal Mehta'), cell('Library', 'Kavita Rao')],
    // P3
    [cell('EVS', 'Priya Nair'), cell('Hindi', 'Anita Desai'), cell('English', 'Neha Sharma'), cell('Maths', 'Rakesh Verma'), cell('Hindi', 'Anita Desai'), cell('Drawing', 'Meera Joshi')],
    // P4
    [cell('Hindi', 'Anita Desai'), cell('Computer', 'Sonal Mehta'), cell('Hindi', 'Anita Desai'), cell('English', 'Neha Sharma'), cell('EVS', 'Priya Nair'), cell('Games', 'Vikram Singh')],
    // P5
    [cell('Computer', 'Sonal Mehta'), cell('EVS', 'Priya Nair'), cell('Drawing', 'Meera Joshi'), cell('Computer', 'Sonal Mehta'), cell('Maths', 'Rakesh Verma'), cell('Library', 'Kavita Rao')],
    // P6
    [cell('Drawing', 'Meera Joshi'), cell('Games', 'Vikram Singh'), cell('Maths', 'Rakesh Verma'), cell('Library', 'Kavita Rao'), cell('Drawing', 'Meera Joshi'), cell('English', 'Neha Sharma')],
    // P7
    [cell('Games', 'Vikram Singh'), cell('Library', 'Kavita Rao'), cell('Computer', 'Sonal Mehta'), cell('Games', 'Vikram Singh'), cell('Social', 'Amit Khanna'), cell('Science', 'Deepa Iyer')],
    // P8
    [cell('Library', 'Kavita Rao'), cell('Drawing', 'Meera Joshi'), cell('Games', 'Vikram Singh'), cell('Drawing', 'Meera Joshi'), cell('Science', 'Deepa Iyer'), cell('Social', 'Amit Khanna')],
  ];
  return pattern;
}

export const DEFAULT_TEACHERS = [
  { name: 'Neha Sharma', subject: 'English', role: 'Class Teacher' },
  { name: 'Rakesh Verma', subject: 'Maths', role: 'Subject Teacher' },
  { name: 'Priya Nair', subject: 'EVS', role: 'Subject Teacher' },
  { name: 'Anita Desai', subject: 'Hindi', role: 'Subject Teacher' },
  { name: 'Sonal Mehta', subject: 'Computer', role: 'Subject Teacher' },
  { name: 'Meera Joshi', subject: 'Drawing', role: 'Subject Teacher' },
  { name: 'Vikram Singh', subject: 'Games', role: 'Subject Teacher' },
  { name: 'Kavita Rao', subject: 'Library', role: 'Subject Teacher' },
];
