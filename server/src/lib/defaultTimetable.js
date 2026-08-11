function cell(subject, teacher) {
  return { subject, teacher };
}

/** Default weekly grid: [periodIndex][dayIndex] Mon–Sat. */
export function buildDefaultWeeklyTimetable() {
  return [
    [
      cell('English', 'Neha Sharma'),
      cell('Maths', 'Rakesh Verma'),
      cell('EVS', 'Priya Nair'),
      cell('Hindi', 'Anita Desai'),
      cell('English', 'Neha Sharma'),
      cell('Games', 'Vikram Singh'),
    ],
    [
      cell('Maths', 'Rakesh Verma'),
      cell('English', 'Neha Sharma'),
      cell('Maths', 'Rakesh Verma'),
      cell('EVS', 'Priya Nair'),
      cell('Computer', 'Sonal Mehta'),
      cell('Library', 'Kavita Rao'),
    ],
    [
      cell('EVS', 'Priya Nair'),
      cell('Hindi', 'Anita Desai'),
      cell('English', 'Neha Sharma'),
      cell('Maths', 'Rakesh Verma'),
      cell('Hindi', 'Anita Desai'),
      cell('Drawing', 'Meera Joshi'),
    ],
    [
      cell('Hindi', 'Anita Desai'),
      cell('Computer', 'Sonal Mehta'),
      cell('Hindi', 'Anita Desai'),
      cell('English', 'Neha Sharma'),
      cell('EVS', 'Priya Nair'),
      cell('Games', 'Vikram Singh'),
    ],
    [
      cell('Computer', 'Sonal Mehta'),
      cell('EVS', 'Priya Nair'),
      cell('Drawing', 'Meera Joshi'),
      cell('Computer', 'Sonal Mehta'),
      cell('Maths', 'Rakesh Verma'),
      cell('Library', 'Kavita Rao'),
    ],
    [
      cell('Drawing', 'Meera Joshi'),
      cell('Games', 'Vikram Singh'),
      cell('Maths', 'Rakesh Verma'),
      cell('Library', 'Kavita Rao'),
      cell('Drawing', 'Meera Joshi'),
      cell('English', 'Neha Sharma'),
    ],
    [
      cell('Games', 'Vikram Singh'),
      cell('Library', 'Kavita Rao'),
      cell('Computer', 'Sonal Mehta'),
      cell('Games', 'Vikram Singh'),
      cell('Social', 'Amit Khanna'),
      cell('Science', 'Deepa Iyer'),
    ],
    [
      cell('Library', 'Kavita Rao'),
      cell('Drawing', 'Meera Joshi'),
      cell('Games', 'Vikram Singh'),
      cell('Drawing', 'Meera Joshi'),
      cell('Science', 'Deepa Iyer'),
      cell('Social', 'Amit Khanna'),
    ],
  ];
}

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
