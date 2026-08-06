import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  BarChart3,
  CalendarDays,
  Download,
  FileText,
  Lightbulb,
  LoaderCircle,
  Printer,
  Users,
} from 'lucide-react';
import { ATTENDANCE_STATUS } from '../data/mockData';
import { formatAttendanceDate, getTodayAttendanceDate } from '../utils/attendance';
import { formatClassRoman } from '../utils/classFormat.js';
import { formatClassLabel } from '../data/schoolGrades.js';
import { getClasses, resolveSectionId } from '../services/classService.js';
import { getStudents } from '../services/studentService.js';
import {
  downloadCsv,
  escapeCsv,
  getDailyReport,
  getMonthlyReport,
  openPrintWindow,
} from '../services/reportService.js';

const REPORT_TYPES = [
  {
    id: 'daily',
    title: 'Daily attendance report',
    description: 'Student-wise status for a class, section, and date.',
    icon: CalendarDays,
    accent: 'bg-violet-100 text-violet-700',
  },
  {
    id: 'monthly',
    title: 'Monthly summary PDF',
    description: 'P / A / L / H / OH / OF counts for the selected month.',
    icon: FileText,
    accent: 'bg-fuchsia-100 text-fuchsia-700',
  },
];

const STATUS_LABEL = {
  P: 'Present',
  A: 'Absent',
  L: 'Late',
  H: 'Half Day',
  OH: 'OD - Half Day',
  OF: 'OD - Full Day',
  O: 'OD - Full Day',
};

/** Daily report: missing row = Present (Present is not stored in DB). */
function dailyStatusCode(status) {
  return status && ATTENDANCE_STATUS[status] ? status : 'P';
}

function dailyStatusLabel(status) {
  return STATUS_LABEL[dailyStatusCode(status)] || 'Present';
}

/** All classes: Class (Roman) | Roll | Section | Name | Status. Otherwise Roll | Section? | Name | Status. */
function dailyReportRowCells(report, student) {
  return [
    ...(report.showClassColumn ? [formatClassRoman(student.className)] : []),
    student.rollNo,
    ...(report.showSectionColumn ? [student.sectionName] : []),
    student.name,
    dailyStatusLabel(student.status),
  ];
}

function dailyReportCsvHeaders(report) {
  return [
    ...(report.showClassColumn ? ['Class'] : []),
    'Roll',
    ...(report.showSectionColumn ? ['Section'] : []),
    'Name',
    'Status',
  ];
}

function statusBadge(status) {
  const code = dailyStatusCode(status);
  const display = ATTENDANCE_STATUS[code];
  return (
    <span className={`rounded-md px-2 py-0.5 text-xs font-medium text-white ${display.color}`}>
      {display.label}
    </span>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="mb-1 block text-xs text-gray-500">{label}</label>
      {children}
    </div>
  );
}

function selectClassName() {
  return 'rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500';
}

const ALL_FILTER = 'all';

function useClassSectionOptions() {
  const [classesData, setClassesData] = useState([]);
  const [selectedClass, setSelectedClass] = useState('1');
  const [selectedSection, setSelectedSection] = useState('A');

  useEffect(() => {
    getClasses()
      .then((data) => {
        const list = data.classes || [];
        setClassesData(list);
        if (list[0]) {
          setSelectedClass(list[0].name);
          const secs = list[0].sections || [];
          setSelectedSection(secs[0]?.name || 'A');
        }
      })
      .catch(() => {});
  }, []);

  const classOptions = useMemo(() => classesData.map((c) => c.name), [classesData]);
  const sectionOptions = useMemo(() => {
    const klass = classesData.find((c) => String(c.name) === String(selectedClass));
    return (klass?.sections || []).map((s) => s.name);
  }, [classesData, selectedClass]);

  useEffect(() => {
    if (selectedClass === ALL_FILTER) {
      setSelectedSection(ALL_FILTER);
      return;
    }
    if (selectedSection === ALL_FILTER) return;
    if (sectionOptions.length && !sectionOptions.includes(selectedSection)) {
      setSelectedSection(sectionOptions[0]);
    }
  }, [sectionOptions, selectedSection, selectedClass]);

  const handleClassChange = (value) => {
    setSelectedClass(value);
    if (value === ALL_FILTER) {
      setSelectedSection(ALL_FILTER);
    }
  };

  return {
    classesData,
    classOptions,
    sectionOptions,
    selectedClass,
    setSelectedClass: handleClassChange,
    selectedSection,
    setSelectedSection,
    allFilter: ALL_FILTER,
  };
}

function FilterBar({ children, onRun, loading, runLabel = 'Generate' }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-end gap-3">
        {children}
        <button
          type="button"
          onClick={onRun}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {loading ? <LoaderCircle size={16} className="animate-spin" /> : null}
          {loading ? 'Loading…' : runLabel}
        </button>
      </div>
    </div>
  );
}

function ExportButtons({ onCsv, onPrint }) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={onCsv}
        className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        <Download size={16} />
        Export CSV
      </button>
      {onPrint ? (
        <button
          type="button"
          onClick={onPrint}
          className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-800 hover:bg-indigo-100"
        >
          <Printer size={16} />
          Print / PDF
        </button>
      ) : null}
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <div className="rounded-xl border border-dashed border-gray-200 bg-white px-6 py-12 text-center text-sm text-gray-500">
      {message}
    </div>
  );
}

function DailyReportView({ onBack }) {
  const {
    classOptions,
    sectionOptions,
    selectedClass,
    setSelectedClass,
    selectedSection,
    setSelectedSection,
    allFilter,
  } = useClassSectionOptions();
  const [date, setDate] = useState(() => getTodayAttendanceDate());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState(null);

  const run = async () => {
    setLoading(true);
    setError('');
    try {
      let data;
      if (selectedClass === allFilter) {
        data = await getDailyReport({ date, className: allFilter, section: allFilter });
      } else if (selectedSection === allFilter) {
        data = await getDailyReport({ date, className: selectedClass, section: allFilter });
      } else {
        const sectionId = await resolveSectionId(selectedClass, selectedSection);
        if (!sectionId) throw new Error('Section not found');
        data = await getDailyReport({ date, sectionId });
      }
      setReport(data);
    } catch (err) {
      setReport(null);
      setError(err.message || 'Failed to load daily report');
    } finally {
      setLoading(false);
    }
  };

  const exportCsv = () => {
    if (!report) return;
    const header = dailyReportCsvHeaders(report).map(escapeCsv).join(',');
    const rows = report.students.map((s) =>
      dailyReportRowCells(report, s).map(escapeCsv).join(',')
    );
    const suffix =
      report.sectionName === 'all'
        ? report.className === 'all'
          ? 'all-classes'
          : `${report.className}-all-sections`
        : `${report.className}${report.sectionName}`;
    downloadCsv(`daily-attendance-${suffix}-${report.date}.csv`, [header, ...rows]);
  };

  return (
    <div className="space-y-4">
      <ReportHeader
        title="Daily attendance report"
        subtitle="Table of students and status for the selected class / section / date"
        onBack={onBack}
      />
      <FilterBar onRun={run} loading={loading}>
        <Field label="Class">
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className={selectClassName()}
          >
            <option value={allFilter}>All classes</option>
            {classOptions.map((c) => (
              <option key={c} value={c}>
                {formatClassLabel(c)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Section">
          <select
            value={selectedSection}
            onChange={(e) => setSelectedSection(e.target.value)}
            disabled={selectedClass === allFilter}
            className={selectClassName()}
          >
            {selectedClass === allFilter ? (
              <option value={allFilter}>All sections</option>
            ) : (
              <>
                <option value={allFilter}>All sections</option>
                {sectionOptions.map((s) => (
                  <option key={s} value={s}>
                    Section {s}
                  </option>
                ))}
              </>
            )}
          </select>
        </Field>
        <Field label="Date">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={selectClassName()}
          />
        </Field>
      </FilterBar>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {!report && !loading ? (
        <EmptyState message="Choose filters and generate the daily attendance report." />
      ) : null}

      {report ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{report.label}</h3>
              <p className="text-sm text-gray-500">{formatAttendanceDate(report.date)}</p>
            </div>
            <ExportButtons onCsv={exportCsv} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['Present', report.summary.present, 'text-green-700'],
              ['Absent', report.summary.absent, 'text-red-600'],
              ['Late / Half / OD', report.summary.late + report.summary.halfDay + (report.summary.odHalfDay || 0) + (report.summary.odFullDay || 0) + (report.summary.onDuty || 0), 'text-amber-700'],
              ['Attendance %', `${report.summary.attendancePercent}%`, 'text-indigo-700'],
            ].map(([label, value, color]) => (
              <div key={label} className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
                <p className="text-xs text-gray-500">{label}</p>
                <p className={`mt-1 text-xl font-bold ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  {report.showClassColumn ? (
                    <th className="px-4 py-3 font-semibold">Class</th>
                  ) : null}
                  <th className="px-4 py-3 font-semibold">Roll</th>
                  {report.showSectionColumn ? (
                    <th className="px-4 py-3 font-semibold">Section</th>
                  ) : null}
                  <th className="px-4 py-3 font-semibold">Name</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {report.students.map((student) => (
                  <tr
                    key={
                      student.studentId +
                      (student.sectionId || '') +
                      (student.className || '')
                    }
                    className="border-t border-gray-100"
                  >
                    {report.showClassColumn ? (
                      <td className="px-4 py-2.5 text-gray-800">
                        {formatClassRoman(student.className)}
                      </td>
                    ) : null}
                    <td className="px-4 py-2.5 font-medium text-gray-800">{student.rollNo}</td>
                    {report.showSectionColumn ? (
                      <td className="px-4 py-2.5 text-gray-800">{student.sectionName}</td>
                    ) : null}
                    <td className="px-4 py-2.5 text-gray-800">{student.name}</td>
                    <td className="px-4 py-2.5">{statusBadge(student.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MonthlyReportView({ onBack }) {
  const {
    classOptions,
    sectionOptions,
    selectedClass,
    setSelectedClass,
    selectedSection,
    setSelectedSection,
  } = useClassSectionOptions();
  const now = new Date(`${getTodayAttendanceDate()}T12:00:00`);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [scope, setScope] = useState('section');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState(null);

  const monthLabel = useMemo(
    () =>
      new Date(year, month - 1, 1).toLocaleDateString('en-GB', {
        month: 'long',
        year: 'numeric',
      }),
    [year, month]
  );

  const run = async () => {
    setLoading(true);
    setError('');
    try {
      let sectionId;
      if (scope === 'section') {
        sectionId = await resolveSectionId(selectedClass, selectedSection);
        if (!sectionId) throw new Error('Section not found');
      }
      const data = await getMonthlyReport({ year, month, sectionId });
      setReport(data);
    } catch (err) {
      setReport(null);
      setError(err.message || 'Failed to load monthly report');
    } finally {
      setLoading(false);
    }
  };

  const exportCsv = () => {
    if (!report) return;
    if (report.mode === 'students') {
      const header = ['Roll', 'Name', 'Present', 'Absent', 'Late', 'Half Day', 'OD Half', 'OD Full', 'Marked', 'Attendance %']
        .map(escapeCsv)
        .join(',');
      const rows = report.students.map((s) =>
        [s.rollNo, s.name, s.present, s.absent, s.late, s.halfDay, s.odHalfDay, s.odFullDay, s.marked, s.attendancePercent]
          .map(escapeCsv)
          .join(',')
      );
      downloadCsv(`monthly-${report.className}${report.sectionName}-${year}-${month}.csv`, [
        header,
        ...rows,
      ]);
      return;
    }
    const header = ['Class', 'Section', 'Students', 'Present', 'Absent', 'Late', 'Half Day', 'OD Half', 'OD Full', 'Attendance %']
      .map(escapeCsv)
      .join(',');
    const rows = report.classes.map((c) =>
      [c.className, c.sectionName, c.studentCount, c.present, c.absent, c.late, c.halfDay, c.odHalfDay, c.odFullDay, c.attendancePercent]
        .map(escapeCsv)
        .join(',')
    );
    downloadCsv(`monthly-all-classes-${year}-${month}.csv`, [header, ...rows]);
  };

  const printPdf = () => {
    if (!report) return;
    const title = `Monthly summary — ${monthLabel}`;
    const subtitle = report.label
      ? `${report.label} · Print or Save as PDF`
      : 'All classes · Print or Save as PDF';
    let body;
    if (report.mode === 'students') {
      const rows = report.students
        .map(
          (s) =>
            `<tr><td>${s.rollNo}</td><td>${s.name}</td><td>${s.present}</td><td>${s.absent}</td><td>${s.late}</td><td>${s.halfDay}</td><td>${s.odHalfDay}</td><td>${s.odFullDay}</td><td>${s.attendancePercent}%</td></tr>`
        )
        .join('');
      body = `<table><thead><tr><th>Roll</th><th>Name</th><th>P</th><th>A</th><th>L</th><th>H</th><th>OH</th><th>OF</th><th>%</th></tr></thead><tbody>${rows}</tbody></table>`;
    } else {
      const rows = report.classes
        .map(
          (c) =>
            `<tr><td>${c.label}</td><td>${c.studentCount}</td><td>${c.present}</td><td>${c.absent}</td><td>${c.late}</td><td>${c.halfDay}</td><td>${c.odHalfDay}</td><td>${c.odFullDay}</td><td>${c.attendancePercent}%</td></tr>`
        )
        .join('');
      body = `<table><thead><tr><th>Class</th><th>Students</th><th>P</th><th>A</th><th>L</th><th>H</th><th>OH</th><th>OF</th><th>%</th></tr></thead><tbody>${rows}</tbody></table>`;
    }
    openPrintWindow(title, body, subtitle);
  };

  return (
    <div className="space-y-4">
      <ReportHeader
        title="Monthly summary PDF"
        subtitle="Month picker with P/A/L/H/OH/OF counts — print to PDF or export CSV"
        onBack={onBack}
      />
      <FilterBar onRun={run} loading={loading}>
        <Field label="Month">
          <input
            type="month"
            value={`${year}-${String(month).padStart(2, '0')}`}
            onChange={(e) => {
              const [y, m] = e.target.value.split('-').map(Number);
              setYear(y);
              setMonth(m);
            }}
            className={selectClassName()}
          />
        </Field>
        <Field label="Scope">
          <select value={scope} onChange={(e) => setScope(e.target.value)} className={selectClassName()}>
            <option value="section">One class / section</option>
            <option value="all">All classes</option>
          </select>
        </Field>
        {scope === 'section' ? (
          <>
            <Field label="Class">
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className={selectClassName()}
              >
                {classOptions.map((c) => (
                  <option key={c} value={c}>
                    {formatClassLabel(c)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Section">
              <select
                value={selectedSection}
                onChange={(e) => setSelectedSection(e.target.value)}
                className={selectClassName()}
              >
                {sectionOptions.map((s) => (
                  <option key={s} value={s}>
                    Section {s}
                  </option>
                ))}
              </select>
            </Field>
          </>
        ) : null}
      </FilterBar>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {!report && !loading ? (
        <EmptyState message="Pick a month and generate the monthly summary." />
      ) : null}

      {report ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                {report.label || 'All classes'} — {monthLabel}
              </h3>
              <p className="text-sm text-gray-500">
                Totals: P {report.totals.present} · A {report.totals.absent} · L {report.totals.late} · H{' '}
                {report.totals.halfDay} · OH {report.totals.odHalfDay} · OF {report.totals.odFullDay} ·{' '}
                {report.totals.attendancePercent}% present
              </p>
            </div>
            <ExportButtons onCsv={exportCsv} onPrint={printPdf} />
          </div>

          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-gray-500">
                {report.mode === 'students' ? (
                  <tr>
                    <th className="px-4 py-3">Roll</th>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">P</th>
                    <th className="px-4 py-3">A</th>
                    <th className="px-4 py-3">L</th>
                    <th className="px-4 py-3">H</th>
                    <th className="px-4 py-3">OH</th>
                    <th className="px-4 py-3">OF</th>
                    <th className="px-4 py-3">%</th>
                  </tr>
                ) : (
                  <tr>
                    <th className="px-4 py-3">Class</th>
                    <th className="px-4 py-3">Students</th>
                    <th className="px-4 py-3">P</th>
                    <th className="px-4 py-3">A</th>
                    <th className="px-4 py-3">L</th>
                    <th className="px-4 py-3">H</th>
                    <th className="px-4 py-3">OH</th>
                    <th className="px-4 py-3">OF</th>
                    <th className="px-4 py-3">%</th>
                  </tr>
                )}
              </thead>
              <tbody>
                {report.mode === 'students'
                  ? report.students.map((s) => (
                      <tr key={s.studentId} className="border-t border-gray-100">
                        <td className="px-4 py-2.5 font-medium">{s.rollNo}</td>
                        <td className="px-4 py-2.5">{s.name}</td>
                        <td className="px-4 py-2.5 text-green-700">{s.present}</td>
                        <td className="px-4 py-2.5 text-red-600">{s.absent}</td>
                        <td className="px-4 py-2.5">{s.late}</td>
                        <td className="px-4 py-2.5">{s.halfDay}</td>
                        <td className="px-4 py-2.5">{s.odHalfDay}</td>
                        <td className="px-4 py-2.5">{s.odFullDay}</td>
                        <td className="px-4 py-2.5 font-semibold text-indigo-700">{s.attendancePercent}%</td>
                      </tr>
                    ))
                  : report.classes.map((c) => (
                      <tr key={c.sectionId} className="border-t border-gray-100">
                        <td className="px-4 py-2.5 font-medium">{c.label}</td>
                        <td className="px-4 py-2.5">{c.studentCount}</td>
                        <td className="px-4 py-2.5 text-green-700">{c.present}</td>
                        <td className="px-4 py-2.5 text-red-600">{c.absent}</td>
                        <td className="px-4 py-2.5">{c.late}</td>
                        <td className="px-4 py-2.5">{c.halfDay}</td>
                        <td className="px-4 py-2.5">{c.odHalfDay}</td>
                        <td className="px-4 py-2.5">{c.odFullDay}</td>
                        <td className="px-4 py-2.5 font-semibold text-indigo-700">{c.attendancePercent}%</td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ReportHeader({ title, subtitle, onBack }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <button
          type="button"
          onClick={onBack}
          className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium text-indigo-700 hover:text-indigo-900"
        >
          <ArrowLeft size={16} />
          All reports
        </button>
        <h2 className="text-xl font-bold text-gray-900">{title}</h2>
        <p className="text-sm text-gray-500">{subtitle}</p>
      </div>
    </div>
  );
}

function classLevelBand(className) {
  const key = String(className ?? '')
    .trim()
    .toUpperCase();
  if (key === 'LKG' || key === 'UKG') return 'Primary';
  if (/^\d+$/.test(key)) {
    const n = Number(key);
    if (n <= 5) return 'Primary';
    if (n <= 8) return 'Middle';
    return 'Secondary';
  }
  return 'General';
}

function ReportsLanding({ onSelect }) {
  const [classesData, setClassesData] = useState([]);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [nominalTarget, setNominalTarget] = useState(null);
  const [nominalStudents, setNominalStudents] = useState([]);
  const [nominalLoading, setNominalLoading] = useState(false);
  const [nominalError, setNominalError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoadingClasses(true);
    getClasses()
      .then((data) => {
        if (!cancelled) setClassesData(data.classes || []);
      })
      .catch(() => {
        if (!cancelled) setClassesData([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingClasses(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const assignedCount = classesData.length;

  const loadNominalRoll = async (klass) => {
    setNominalTarget(klass);
    setNominalLoading(true);
    setNominalError('');
    setNominalStudents([]);
    try {
      const lists = await Promise.all(
        (klass.sections || []).map(async (sec) => {
          const data = await getStudents({ sectionId: sec.id });
          return (data.students || []).map((s) => ({
            ...s,
            sectionName: sec.name,
          }));
        })
      );
      const merged = lists
        .flat()
        .sort(
          (a, b) =>
            String(a.sectionName).localeCompare(String(b.sectionName)) ||
            Number(a.rollNo ?? a.roll) - Number(b.rollNo ?? b.roll)
        );
      setNominalStudents(merged);
    } catch (err) {
      setNominalError(err.message || 'Failed to load nominal roll');
    } finally {
      setNominalLoading(false);
    }
  };

  const downloadNominalRoll = async (klass) => {
    try {
      const lists = await Promise.all(
        (klass.sections || []).map(async (sec) => {
          const data = await getStudents({ sectionId: sec.id });
          return (data.students || []).map((s) => ({
            ...s,
            sectionName: sec.name,
          }));
        })
      );
      const students = lists
        .flat()
        .sort(
          (a, b) =>
            String(a.sectionName).localeCompare(String(b.sectionName)) ||
            Number(a.rollNo ?? a.roll) - Number(b.rollNo ?? b.roll)
        );
      const header = ['Class', 'Section', 'Roll', 'Name', 'Status'].map(escapeCsv).join(',');
      const rows = students.map((s) =>
        [
          formatClassLabel(klass.name),
          s.sectionName,
          s.rollNo ?? s.roll,
          s.name,
          s.status || 'Active',
        ]
          .map(escapeCsv)
          .join(',')
      );
      downloadCsv(
        `nominal-roll-${klass.name}-${(klass.sections || []).map((s) => s.name).join('')}.csv`,
        [header, ...rows]
      );
    } catch (err) {
      setNominalError(err.message || 'Failed to download nominal roll');
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-violet-800/20 bg-gradient-to-br from-[#4c1d95] via-[#5b21b6] to-[#6d28d9] p-6 text-white shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20">
            <BarChart3 size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Reports</h2>
            <p className="mt-1 max-w-2xl text-sm text-violet-100">
              Generate attendance reports and monthly summaries from live attendance data.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {REPORT_TYPES.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              className="group rounded-2xl border border-gray-200 bg-white p-5 text-left shadow-sm transition hover:border-violet-300 hover:shadow-md"
            >
              <div
                className={`mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl ${item.accent}`}
              >
                <Icon size={22} />
              </div>
              <h3 className="text-base font-semibold text-gray-900 group-hover:text-violet-800">
                {item.title}
              </h3>
              <p className="mt-1 text-sm text-gray-500">{item.description}</p>
              <p className="mt-3 text-xs font-semibold text-violet-600">Open report →</p>
            </button>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div>
            <h3 className="text-base font-bold text-gray-900">
              Class Nominal Roll{' '}
              <span className="font-medium text-gray-500">(Access based on your role)</span>
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              You can view nominal rolls and generate reports only for the classes you are assigned
              to.
            </p>
          </div>
          <span className="inline-flex items-center rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700 ring-1 ring-violet-100">
            {loadingClasses
              ? 'Loading…'
              : `${assignedCount} ${assignedCount === 1 ? 'Class' : 'Classes'} Assigned`}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-5 py-3 font-semibold">Class</th>
                <th className="px-5 py-3 font-semibold">Section(s)</th>
                <th className="px-5 py-3 font-semibold">Students</th>
                <th className="px-5 py-3 font-semibold">Nominal Roll</th>
                <th className="px-5 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loadingClasses ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-gray-500">
                    <LoaderCircle size={18} className="mx-auto mb-2 animate-spin text-violet-500" />
                    Loading assigned classes…
                  </td>
                </tr>
              ) : null}
              {!loadingClasses && !classesData.length ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-gray-500">
                    No classes assigned to your account.
                  </td>
                </tr>
              ) : null}
              {classesData.map((klass, idx) => {
                const studentTotal = (klass.sections || []).reduce(
                  (n, s) => n + (s.studentCount || 0),
                  0
                );
                const sections = klass.sections || [];
                return (
                  <tr key={klass.id || klass.name} className="border-t border-gray-100">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-sm font-bold text-violet-700">
                          {idx + 1}
                        </span>
                        <div>
                          <p className="font-semibold text-gray-900">
                            {formatClassLabel(klass.name)}
                          </p>
                          <p className="text-xs text-gray-500">{classLevelBand(klass.name)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        {sections.length ? (
                          sections.map((s) => (
                            <span
                              key={s.id || s.name}
                              className="inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100"
                            >
                              {s.name}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1.5 text-gray-700">
                        <Users size={14} className="text-violet-500" />
                        <span className="font-medium">{studentTotal}</span>
                        <span className="text-gray-500">Students</span>
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <button
                        type="button"
                        onClick={() => loadNominalRoll(klass)}
                        className="inline-flex items-center gap-1.5 text-sm font-semibold text-violet-700 hover:text-violet-900"
                      >
                        <FileText size={14} />
                        View Nominal Roll →
                      </button>
                    </td>
                    <td className="px-5 py-4">
                      <button
                        type="button"
                        onClick={() => downloadNominalRoll(klass)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm hover:bg-gray-50"
                      >
                        <Download size={14} />
                        Download
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="border-t border-sky-100 bg-sky-50 px-5 py-3 text-sm text-sky-900">
          If you need access to other classes, please contact the In-Charge or Administrator.
        </div>
      </div>

      <div className="rounded-xl border border-violet-100 bg-violet-50 px-4 py-3 text-xs text-violet-900">
        <span className="inline-flex items-center gap-1.5 font-semibold">
          <Lightbulb size={14} className="text-violet-600" />
          Tip
        </span>
        {' — '}
        Daily reports support a single class/section. Monthly reports can be generated for any class
        you have access to.
      </div>

      {nominalTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  Nominal Roll — {formatClassLabel(nominalTarget.name)}
                </h3>
                <p className="text-sm text-gray-500">
                  Sections{' '}
                  {(nominalTarget.sections || []).map((s) => s.name).join(', ') || '—'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setNominalTarget(null)}
                className="rounded-lg px-2 py-1 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-800"
              >
                Close
              </button>
            </div>
            <div className="flex-1 overflow-auto px-5 py-3">
              {nominalLoading ? (
                <p className="flex items-center justify-center gap-2 py-12 text-sm text-gray-500">
                  <LoaderCircle size={16} className="animate-spin" /> Loading students…
                </p>
              ) : null}
              {nominalError ? <p className="py-6 text-sm text-red-600">{nominalError}</p> : null}
              {!nominalLoading && !nominalError ? (
                <table className="min-w-full text-left text-sm">
                  <thead className="sticky top-0 bg-white text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="py-2 pr-3">Section</th>
                      <th className="py-2 pr-3">Roll</th>
                      <th className="py-2">Name</th>
                    </tr>
                  </thead>
                  <tbody>
                    {nominalStudents.map((s) => (
                      <tr key={s.id} className="border-t border-gray-100">
                        <td className="py-2 pr-3 text-gray-600">{s.sectionName}</td>
                        <td className="py-2 pr-3 font-medium">{s.rollNo ?? s.roll}</td>
                        <td className="py-2 text-gray-900">{s.name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : null}
              {!nominalLoading && !nominalError && !nominalStudents.length ? (
                <p className="py-8 text-center text-sm text-gray-500">No students in this class.</p>
              ) : null}
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-3">
              <button
                type="button"
                onClick={() => downloadNominalRoll(nominalTarget)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-700"
              >
                <Download size={14} />
                Download CSV
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function ReportsPage() {
  const [activeReport, setActiveReport] = useState(null);

  if (activeReport === 'daily') return <DailyReportView onBack={() => setActiveReport(null)} />;
  if (activeReport === 'monthly') return <MonthlyReportView onBack={() => setActiveReport(null)} />;

  return <ReportsLanding onSelect={setActiveReport} />;
}
