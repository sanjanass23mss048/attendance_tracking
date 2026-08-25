/**
 * Rich demo payload for Attendance Intelligence walkthroughs
 * when a tenant has little/no live attendance data yet.
 */

function addDays(iso, n) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function student(partial) {
  return {
    studentClassId: partial.id,
    studentRecordId: `demo-rec-${partial.id}`,
    name: partial.name,
    className: partial.className,
    sectionName: partial.sectionName,
    classLabel: `${partial.className}-${partial.sectionName}`,
    rollNo: partial.rollNo,
    fatherName: partial.fatherName || '',
    motherName: partial.motherName || '',
    guardianName: partial.guardianName || '',
    lastAttended: partial.lastAttended,
    consecutiveAbsent: partial.consecutiveAbsent ?? 0,
    absentIn30: partial.absentIn30 ?? 0,
    halfIn30: partial.halfIn30 ?? 0,
    monFriAbsentIn30: partial.monFriAbsentIn30 ?? 0,
    attendancePct30: partial.attendancePct30 ?? null,
    attendancePctRecent: partial.attendancePctRecent ?? null,
    attendancePctPrior: partial.attendancePctPrior ?? null,
    pctDrop: partial.pctDrop ?? 0,
    parentInformed: Boolean(partial.parentInformed),
    uncoveredAbsences: partial.uncoveredAbsences ?? 0,
    severity: partial.severity || 'medium',
    reasons: partial.reasons || [],
    headline: partial.headline,
    meetingRequired: Boolean(partial.meetingRequired),
    risk: partial.risk,
    summary: partial.summary || partial.reasons?.slice(0, 3) || [],
  };
}

/** @param {string} [asOf] YYYY-MM-DD — defaults to today (clear demo date for walkthroughs) */
export function buildDemoAttendanceIntelligence(asOf, thresholds = {}) {
  const demoDate =
    asOf && /^\d{4}-\d{2}-\d{2}$/.test(String(asOf))
      ? String(asOf)
      : new Date().toISOString().slice(0, 10);
  asOf = demoDate;
  const longAbsences = [
    student({
      id: 'demo-sc-aarav',
      name: 'Aarav Sharma',
      className: '7',
      sectionName: 'A',
      rollNo: '12',
      fatherName: 'Rajesh Sharma',
      consecutiveAbsent: 6,
      absentIn30: 8,
      lastAttended: addDays(asOf, -7),
      parentInformed: true,
      severity: 'critical',
      meetingRequired: true,
      headline: 'Absent for 6 consecutive days',
      reasons: ['Absent for 6 consecutive days', '8 absent days in the last 30 days'],
    }),
    student({
      id: 'demo-sc-diya',
      name: 'Diya Nair',
      className: '5',
      sectionName: 'B',
      rollNo: '04',
      consecutiveAbsent: 4,
      absentIn30: 5,
      lastAttended: addDays(asOf, -5),
      parentInformed: false,
      severity: 'high',
      meetingRequired: true,
      headline: 'Absent for 4 consecutive days',
      reasons: ['Absent for 4 consecutive days'],
    }),
    student({
      id: 'demo-sc-rohan',
      name: 'Rohan Das',
      className: '9',
      sectionName: 'A',
      rollNo: '21',
      consecutiveAbsent: 3,
      absentIn30: 6,
      lastAttended: addDays(asOf, -4),
      parentInformed: true,
      severity: 'high',
      meetingRequired: true,
      headline: 'Absent for 3 consecutive days',
      reasons: ['Absent for 3 consecutive days', '6 absent days in the last 30 days'],
    }),
    student({
      id: 'demo-sc-meera',
      name: 'Meera Iyer',
      className: '6',
      sectionName: 'A',
      rollNo: '09',
      consecutiveAbsent: 0,
      absentIn30: 7,
      lastAttended: addDays(asOf, -2),
      parentInformed: false,
      severity: 'critical',
      meetingRequired: true,
      headline: '7 absences in the last 30 days',
      reasons: ['7 absent days in the last 30 days', '4 absences without a leave letter'],
      uncoveredAbsences: 4,
    }),
    student({
      id: 'demo-sc-kabir',
      name: 'Kabir Menon',
      className: '8',
      sectionName: 'C',
      rollNo: '15',
      consecutiveAbsent: 5,
      absentIn30: 5,
      lastAttended: addDays(asOf, -6),
      parentInformed: true,
      severity: 'high',
      meetingRequired: true,
      headline: 'Absent for 5 consecutive days',
      reasons: ['Absent for 5 consecutive days'],
    }),
  ];

  const patterns = [
    student({
      id: 'demo-sc-ananya',
      name: 'Ananya Krishnan',
      className: '10',
      sectionName: 'B',
      rollNo: '03',
      monFriAbsentIn30: 5,
      absentIn30: 5,
      attendancePct30: 72,
      risk: 'High',
      severity: 'high',
      lastAttended: addDays(asOf, -1),
      reasons: ['5 Monday/Friday absences in the last 30 days'],
      summary: ['Repeated Monday/Friday absence'],
    }),
    student({
      id: 'demo-sc-vihaan',
      name: 'Vihaan Patel',
      className: '4',
      sectionName: 'A',
      rollNo: '18',
      halfIn30: 6,
      absentIn30: 2,
      attendancePct30: 81,
      risk: 'Medium',
      severity: 'medium',
      lastAttended: asOf,
      reasons: ['6 half-days / OD half-days in the last 30 days'],
      summary: ['Frequent half days'],
    }),
    student({
      id: 'demo-sc-sara',
      name: 'Sara Fernandes',
      className: '3',
      sectionName: 'B',
      rollNo: '07',
      pctDrop: 14,
      attendancePctRecent: 76,
      attendancePctPrior: 90,
      attendancePct30: 78,
      risk: 'High',
      severity: 'high',
      lastAttended: addDays(asOf, -1),
      reasons: ['Attendance dropped from 90% → 76% in ~3 months'],
      summary: ['Falling attendance %'],
    }),
    student({
      id: 'demo-sc-arjun',
      name: 'Arjun Reddy',
      className: '11',
      sectionName: 'A',
      rollNo: '02',
      uncoveredAbsences: 4,
      absentIn30: 4,
      risk: 'Watch',
      severity: 'medium',
      lastAttended: addDays(asOf, -3),
      reasons: ['4 absences without a leave letter (30 days)'],
      summary: ['Leave without letter'],
    }),
    student({
      id: 'demo-sc-isha',
      name: 'Isha Banerjee',
      className: '2',
      sectionName: 'A',
      rollNo: '11',
      consecutiveAbsent: 3,
      absentIn30: 3,
      risk: 'Medium',
      severity: 'high',
      lastAttended: addDays(asOf, -4),
      reasons: ['Absent for 3 consecutive days'],
      summary: ['Consecutive absence'],
    }),
    ...longAbsences.map((a) => ({
      ...a,
      risk: a.severity === 'critical' ? 'High' : a.severity === 'high' ? 'Medium' : 'Watch',
      summary: a.reasons.slice(0, 2),
    })),
  ];

  // Dedupe patterns by studentClassId (long absentees already in list)
  const seen = new Set();
  const uniquePatterns = [];
  for (const p of patterns) {
    if (seen.has(p.studentClassId)) continue;
    seen.add(p.studentClassId);
    uniquePatterns.push(p);
  }

  const meetings = [
    {
      id: 'demo-meet-1',
      studentClassId: 'demo-sc-aarav',
      studentRecordId: 'demo-rec-demo-sc-aarav',
      parentName: 'Rajesh Sharma',
      reason: 'Continuous Absence',
      meetingDate: asOf,
      staffName: 'Principal',
      discussionNotes: 'Parents informed; medical certificate pending.',
      outcome: '',
      followUpDate: addDays(asOf, 7),
      status: 'Scheduled',
      createdBy: null,
      createdOn: asOf,
      updatedOn: asOf,
      student: {
        name: 'Aarav Sharma',
        className: '7',
        sectionName: 'A',
        rollNo: '12',
      },
    },
    {
      id: 'demo-meet-2',
      studentClassId: 'demo-sc-diya',
      studentRecordId: 'demo-rec-demo-sc-diya',
      parentName: 'Priya Nair',
      reason: 'Frequent Leave',
      meetingDate: addDays(asOf, -2),
      staffName: 'Vice Principal',
      discussionNotes: 'Discussed travel during school days.',
      outcome: 'Parents agreed to reduce mid-week leave',
      followUpDate: addDays(asOf, 5),
      status: 'Completed',
      createdBy: null,
      createdOn: addDays(asOf, -2),
      updatedOn: addDays(asOf, -2),
      student: {
        name: 'Diya Nair',
        className: '5',
        sectionName: 'B',
        rollNo: '04',
      },
    },
    {
      id: 'demo-meet-3',
      studentClassId: 'demo-sc-meera',
      studentRecordId: 'demo-rec-demo-sc-meera',
      parentName: 'Suresh Iyer',
      reason: 'High Absenteeism',
      meetingDate: addDays(asOf, -5),
      staffName: 'Class Teacher',
      discussionNotes: 'Follow-up needed on leave letters.',
      outcome: '',
      followUpDate: addDays(asOf, 2),
      status: 'Follow-up Required',
      createdBy: null,
      createdOn: addDays(asOf, -5),
      updatedOn: addDays(asOf, -1),
      student: {
        name: 'Meera Iyer',
        className: '6',
        sectionName: 'A',
        rollNo: '09',
      },
    },
    {
      id: 'demo-meet-4',
      studentClassId: 'demo-sc-ananya',
      studentRecordId: 'demo-rec-demo-sc-ananya',
      parentName: 'Lakshmi Krishnan',
      reason: 'Monday/Friday Pattern',
      meetingDate: addDays(asOf, 1),
      staffName: 'Counsellor',
      discussionNotes: '',
      outcome: '',
      followUpDate: addDays(asOf, 14),
      status: 'Scheduled',
      createdBy: null,
      createdOn: asOf,
      updatedOn: asOf,
      student: {
        name: 'Ananya Krishnan',
        className: '10',
        sectionName: 'B',
        rollNo: '03',
      },
    },
  ];

  const followUps = meetings.filter(
    (m) =>
      m.status === 'Follow-up Required' ||
      (m.followUpDate && m.status !== 'Closed' && m.followUpDate <= addDays(asOf, 7))
  );

  const patternCategories = [
    { key: 'monFri', label: 'Repeated Monday/Friday Absence', count: 6, color: '#6366f1' },
    { key: 'holiday', label: 'Before/After Holidays', count: 4, color: '#ec4899' },
    { key: 'half', label: 'Frequent Half Days', count: 3, color: '#f59e0b' },
    { key: 'monthly', label: 'Every Month Repeated Leave', count: 3, color: '#14b8a6' },
    { key: 'streak', label: 'Consecutive Absence', count: 2, color: '#ef4444' },
  ];

  const trendSeed = [92, 90, 88, 85, 82, 78];
  const monthlyTrend = [];
  for (let i = 5; i >= 0; i -= 1) {
    const ref = new Date(`${asOf}T12:00:00`);
    ref.setDate(1);
    ref.setMonth(ref.getMonth() - i);
    monthlyTrend.push({
      month: ref.toLocaleString('en-US', { month: 'short', year: '2-digit' }),
      pct: trendSeed[5 - i],
    });
  }

  const highRisk = uniquePatterns.filter((p) => p.risk === 'High');

  return {
    demo: true,
    asOf,
    demoLabel: `Demo date ${asOf}`,
    thresholds,
    summary: {
      longAbsentees: {
        total: longAbsences.length,
        immediate: longAbsences.filter((a) => a.severity === 'critical' || a.severity === 'high').length,
      },
      meetings: {
        today: meetings.filter((m) => m.meetingDate === asOf).length,
        followups: meetings.filter((m) => m.status === 'Follow-up Required').length,
        open: meetings.filter((m) => m.status !== 'Closed' && m.status !== 'Completed').length,
      },
      patterns: {
        flagged: uniquePatterns.length,
        highRisk: highRisk.length,
      },
      followUps: {
        total: followUps.length,
      },
      overallPct: 78,
      monthDelta: -4,
    },
    patternCategories,
    monthlyTrend,
    longAbsences,
    patterns: uniquePatterns,
    meetings,
    followUps,
  };
}

export function isDemoStudentClassId(id) {
  return String(id || '').startsWith('demo-');
}

/** Scenario shapes applied onto real enrollments when live alerts are empty. */
const WALKTHROUGH_SCENARIOS = [
  {
    consecutiveAbsent: 6,
    absentIn30: 8,
    severity: 'critical',
    meetingRequired: true,
    risk: 'High',
    headline: 'Absent for 6 consecutive days',
    reasons: ['Absent for 6 consecutive days', '8 absent days in the last 30 days'],
    parentInformed: true,
    lastAttendedOffset: -7,
  },
  {
    consecutiveAbsent: 4,
    absentIn30: 5,
    severity: 'high',
    meetingRequired: true,
    risk: 'High',
    headline: 'Absent for 4 consecutive days',
    reasons: ['Absent for 4 consecutive days'],
    parentInformed: false,
    lastAttendedOffset: -5,
  },
  {
    consecutiveAbsent: 3,
    absentIn30: 6,
    severity: 'high',
    meetingRequired: true,
    risk: 'High',
    headline: 'Absent for 3 consecutive days',
    reasons: ['Absent for 3 consecutive days', '6 absent days in the last 30 days'],
    parentInformed: true,
    lastAttendedOffset: -4,
  },
  {
    consecutiveAbsent: 0,
    absentIn30: 7,
    severity: 'critical',
    meetingRequired: true,
    risk: 'High',
    headline: '7 absences in the last 30 days',
    reasons: ['7 absent days in the last 30 days', '4 absences without a leave letter'],
    uncoveredAbsences: 4,
    parentInformed: false,
    lastAttendedOffset: -2,
  },
  {
    consecutiveAbsent: 5,
    absentIn30: 5,
    severity: 'high',
    meetingRequired: true,
    risk: 'Medium',
    headline: 'Absent for 5 consecutive days',
    reasons: ['Absent for 5 consecutive days'],
    parentInformed: true,
    lastAttendedOffset: -6,
  },
  {
    consecutiveAbsent: 0,
    absentIn30: 4,
    halfIn30: 5,
    monFriAbsentIn30: 3,
    severity: 'medium',
    meetingRequired: false,
    risk: 'Medium',
    headline: 'Repeated Monday/Friday absences',
    reasons: ['3 Monday/Friday absences in the last 30 days', '5 half-days in the last 30 days'],
    parentInformed: false,
    lastAttendedOffset: -1,
  },
  {
    consecutiveAbsent: 0,
    absentIn30: 5,
    pctDrop: 18,
    attendancePctRecent: 72,
    attendancePctPrior: 90,
    severity: 'high',
    meetingRequired: true,
    risk: 'High',
    headline: 'Attendance dropped sharply',
    reasons: ['Attendance dropped from 90% → 72% in ~3 months'],
    parentInformed: true,
    lastAttendedOffset: -3,
  },
  {
    consecutiveAbsent: 2,
    absentIn30: 4,
    severity: 'medium',
    meetingRequired: false,
    risk: 'Watch',
    headline: 'Watch: rising absences',
    reasons: ['4 absent days in the last 30 days'],
    parentInformed: false,
    lastAttendedOffset: -2,
  },
];

/**
 * When a school has real students but no attendance alerts yet, show walkthrough
 * cards bound to real enrollment IDs so Schedule Meeting / WhatsApp can persist.
 */
export function buildWalkthroughFromEnrollments(
  enrollments,
  { asOf, thresholds = {}, meetings = [] } = {}
) {
  const demoDate =
    asOf && /^\d{4}-\d{2}-\d{2}$/.test(String(asOf))
      ? String(asOf)
      : new Date().toISOString().slice(0, 10);

  const picked = (enrollments || []).slice(0, WALKTHROUGH_SCENARIOS.length);
  if (!picked.length) {
    return buildDemoAttendanceIntelligence(demoDate, thresholds);
  }

  const longAbsences = [];
  const patterns = [];

  picked.forEach((en, i) => {
    const scenario = WALKTHROUGH_SCENARIOS[i];
    const row = student({
      id: en.studentClassId,
      name: en.name,
      className: en.className,
      sectionName: en.sectionName,
      rollNo: en.rollNo,
      consecutiveAbsent: scenario.consecutiveAbsent,
      absentIn30: scenario.absentIn30,
      halfIn30: scenario.halfIn30,
      monFriAbsentIn30: scenario.monFriAbsentIn30,
      lastAttended: addDays(demoDate, scenario.lastAttendedOffset || -3),
      parentInformed: scenario.parentInformed,
      severity: scenario.severity,
      meetingRequired: scenario.meetingRequired,
      headline: scenario.headline,
      reasons: scenario.reasons,
      uncoveredAbsences: scenario.uncoveredAbsences,
      pctDrop: scenario.pctDrop,
      attendancePctRecent: scenario.attendancePctRecent,
      attendancePctPrior: scenario.attendancePctPrior,
      risk: scenario.risk,
      summary: scenario.reasons?.slice(0, 3),
    });
    row.studentRecordId = en.studentRecordId || row.studentRecordId;
    row.fatherName = en.fatherName || '';
    row.motherName = en.motherName || '';
    row.guardianName = en.guardianName || '';
    if (scenario.meetingRequired || scenario.severity === 'critical' || scenario.severity === 'high') {
      longAbsences.push(row);
    }
    patterns.push(row);
  });

  const followUps = (meetings || []).filter(
    (m) =>
      m.status === 'Follow-up Required' ||
      (m.followUpDate && m.status !== 'Closed' && m.followUpDate <= addDays(demoDate, 7))
  );

  const patternCategories = [
    {
      key: 'monFri',
      label: 'Repeated Monday/Friday Absence',
      count: patterns.filter((p) => (p.monFriAbsentIn30 || 0) >= 2).length,
      color: '#6366f1',
    },
    { key: 'holiday', label: 'Before/After Holidays', count: 0, color: '#ec4899' },
    {
      key: 'half',
      label: 'Frequent Half Days',
      count: patterns.filter((p) => (p.halfIn30 || 0) >= 3).length,
      color: '#f59e0b',
    },
    { key: 'monthly', label: 'Every Month Repeated Leave', count: 0, color: '#14b8a6' },
    {
      key: 'streak',
      label: 'Consecutive Absence',
      count: patterns.filter((p) => (p.consecutiveAbsent || 0) >= 3).length,
      color: '#ef4444',
    },
  ];

  const trendSeed = [92, 90, 88, 85, 82, 78];
  const monthlyTrend = [];
  for (let i = 5; i >= 0; i -= 1) {
    const ref = new Date(`${demoDate}T12:00:00`);
    ref.setDate(1);
    ref.setMonth(ref.getMonth() - i);
    monthlyTrend.push({
      month: ref.toLocaleString('en-US', { month: 'short', year: '2-digit' }),
      pct: trendSeed[5 - i],
    });
  }

  const highRisk = patterns.filter((p) => p.risk === 'High');

  return {
    demo: false,
    walkthrough: true,
    asOf: demoDate,
    demoLabel: `Sample alerts using real students (${demoDate}) — meetings & WhatsApp are live`,
    thresholds,
    summary: {
      longAbsentees: {
        total: longAbsences.length,
        immediate: longAbsences.filter((a) => a.severity === 'critical' || a.severity === 'high')
          .length,
      },
      meetings: {
        today: (meetings || []).filter((m) => m.meetingDate === demoDate).length,
        followups: (meetings || []).filter((m) => m.status === 'Follow-up Required').length,
        open: (meetings || []).filter((m) => m.status !== 'Closed' && m.status !== 'Completed')
          .length,
      },
      patterns: {
        flagged: patterns.length,
        highRisk: highRisk.length,
      },
      followUps: {
        total: followUps.length,
      },
      overallPct: 78,
      monthDelta: -4,
    },
    patternCategories,
    monthlyTrend,
    longAbsences,
    patterns,
    meetings: meetings || [],
    followUps,
  };
}
