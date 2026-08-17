import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  BarChart3,
  CalendarDays,
  Download,
  FileText,
  LoaderCircle,
  Printer,
  Users,
  X,
} from 'lucide-react';
import { ATTENDANCE_STATUS } from '../data/mockData';
import { formatAttendanceDate, getTodayAttendanceDate } from '../utils/attendance';
import { formatClassRoman } from '../utils/classFormat.js';
import { formatClassLabel } from '../data/schoolGrades.js';
import { getClasses, resolveSectionId } from '../services/classService.js';
import { getStudents } from '../services/studentService.js';
import {
  exportNominalRollPdf,
  exportTablePdfReport,
  getDailyReport,
  getMonthlyReport,
} from '../services/reportService.js';
import { canManageTeachers } from '../data/navItems.js';
import { getTeachers } from '../services/teacherService.js';
import AttendanceReportsApp from './reports/AttendanceReportsApp.jsx';
import { parseAttendancePath } from './reports/attendancePaths.js';

const REPORT_TYPES = [
  {
    id: 'attendance',
    title: 'Attendance Reports',
    description: 'School → standard → section → status → student drill-down.',
    icon: BarChart3,
    accent: 'bg-indigo-100 text-indigo-700',
  },
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

function ExportButtons({ onCsv, onPrint, exporting = false }) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={onCsv}
        disabled={exporting}
        className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-wait disabled:opacity-60"
      >
        {exporting ? <LoaderCircle size={16} className="animate-spin" /> : <Download size={16} />}
        {exporting ? 'Exporting…' : 'Export PDF'}
      </button>
      {onPrint ? (
        <button
          type="button"
          onClick={onPrint}
          disabled={exporting}
          className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-800 hover:bg-indigo-100 disabled:opacity-60"
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
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [exportNotice, setExportNotice] = useState('');
  const [report, setReport] = useState(null);

  const run = async () => {
    setLoading(true);
    setError('');
    setExportNotice('');
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

  const exportCsv = async () => {
    if (!report) return;
    setExporting(true);
    setError('');
    setExportNotice('');
    try {
      const headers = dailyReportCsvHeaders(report);
      const rows = report.students.map((s) => dailyReportRowCells(report, s));
      exportTablePdfReport({
        title: 'ATTENDANCE REPORT',
        pill: report.label || 'Daily',
        dateLabel: formatAttendanceDate(report.date),
        headers,
        rows,
      });
      setExportNotice('Print dialog opened — choose Save as PDF.');
    } catch (err) {
      setError(err.message || 'Failed to export PDF');
    } finally {
      setExporting(false);
    }
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
      {exportNotice ? <p className="text-sm text-emerald-700">{exportNotice}</p> : null}

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
            <ExportButtons onCsv={exportCsv} exporting={exporting} />
          </div>

          {report.holiday ? (
            <p className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-900">
              This date is a Sunday or calendar holiday and is excluded from attendance reports.
            </p>
          ) : null}
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
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [exportNotice, setExportNotice] = useState('');
  const [report, setReport] = useState(null);
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);

  const monthLabel = useMemo(
    () =>
      new Date(year, month - 1, 1).toLocaleDateString('en-GB', {
        month: 'long',
        year: 'numeric',
      }),
    [year, month]
  );

  useEffect(() => {
    if (!pdfPreviewOpen) return undefined;
    window.history.pushState({ monthlyPrintPreview: true }, '');
    const onPopState = () => setPdfPreviewOpen(false);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [pdfPreviewOpen]);

  const dismissPdfPreview = () => {
    if (window.history.state?.monthlyPrintPreview) {
      window.history.back();
    } else {
      setPdfPreviewOpen(false);
    }
  };

  const run = async () => {
    setLoading(true);
    setError('');
    setExportNotice('');
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

  const exportCsv = async () => {
    if (!report) return;
    setExporting(true);
    setError('');
    setExportNotice('');
    try {
      if (report.mode === 'students') {
        exportTablePdfReport({
          title: 'MONTHLY SUMMARY',
          pill: report.label || monthLabel,
          dateLabel: monthLabel,
          headers: ['Roll', 'Name', 'Present', 'Absent', 'Late', 'Half Day', 'OD Half', 'OD Full', 'Marked', 'Attendance %'],
          rows: report.students.map((s) => [
            s.rollNo,
            s.name,
            s.present,
            s.absent,
            s.late,
            s.halfDay,
            s.odHalfDay,
            s.odFullDay,
            s.marked,
            `${s.attendancePercent}%`,
          ]),
        });
      } else {
        exportTablePdfReport({
          title: 'MONTHLY SUMMARY',
          pill: 'All classes',
          dateLabel: monthLabel,
          headers: ['Class', 'Section', 'Students', 'Present', 'Absent', 'Late', 'Half Day', 'OD Half', 'OD Full', 'Attendance %'],
          rows: report.classes.map((c) => [
            c.className,
            c.sectionName,
            c.studentCount,
            c.present,
            c.absent,
            c.late,
            c.halfDay,
            c.odHalfDay,
            c.odFullDay,
            `${c.attendancePercent}%`,
          ]),
        });
      }
      setExportNotice('Print dialog opened — choose Save as PDF.');
    } catch (err) {
      setError(err.message || 'Failed to export PDF');
    } finally {
      setExporting(false);
    }
  };

  const printPdf = () => {
    if (!report) return;
    setPdfPreviewOpen(true);
  };

  const savePdfPreview = async () => {
    if (!report) return;
    setError('');
    setExportNotice('');
    try {
      await exportCsv();
      dismissPdfPreview();
    } catch (err) {
      setError(err.message || 'Failed to export');
    }
  };

  return (
    <div className="space-y-4">
      <ReportHeader
        title="Monthly summary PDF"
        subtitle="Month picker with P/A/L/H/OH/OF counts — print or export as PDF"
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
      {exportNotice ? <p className="text-sm text-emerald-700">{exportNotice}</p> : null}
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
            <ExportButtons onCsv={exportCsv} onPrint={printPdf} exporting={exporting} />
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

      {pdfPreviewOpen && report ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center sm:p-4">
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-4 py-3 sm:px-5 sm:py-4">
              <div>
                <h3 className="text-base font-bold text-gray-900 sm:text-lg">
                  Monthly summary — {monthLabel}
                </h3>
                <p className="text-xs text-gray-500 sm:text-sm">
                  {report.label || 'All classes'} · Preview stays in the app. Back or Close returns here.
                </p>
              </div>
              <button
                type="button"
                onClick={dismissPdfPreview}
                className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                aria-label="Close preview"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-auto px-4 py-3 sm:px-5">
              <table className="min-w-full text-left text-sm">
                <thead className="sticky top-0 bg-white text-xs uppercase tracking-wide text-gray-500">
                  {report.mode === 'students' ? (
                    <tr>
                      <th className="py-2 pr-3">Roll</th>
                      <th className="py-2 pr-3">Name</th>
                      <th className="py-2 pr-2">P</th>
                      <th className="py-2 pr-2">A</th>
                      <th className="py-2 pr-2">L</th>
                      <th className="py-2 pr-2">H</th>
                      <th className="py-2 pr-2">OH</th>
                      <th className="py-2 pr-2">OF</th>
                      <th className="py-2">%</th>
                    </tr>
                  ) : (
                    <tr>
                      <th className="py-2 pr-3">Class</th>
                      <th className="py-2 pr-3">Students</th>
                      <th className="py-2 pr-2">P</th>
                      <th className="py-2 pr-2">A</th>
                      <th className="py-2 pr-2">L</th>
                      <th className="py-2 pr-2">H</th>
                      <th className="py-2 pr-2">OH</th>
                      <th className="py-2 pr-2">OF</th>
                      <th className="py-2">%</th>
                    </tr>
                  )}
                </thead>
                <tbody>
                  {report.mode === 'students'
                    ? report.students.map((s) => (
                        <tr key={s.studentId} className="border-t border-gray-100">
                          <td className="py-2 pr-3 font-medium">{s.rollNo}</td>
                          <td className="py-2 pr-3">{s.name}</td>
                          <td className="py-2 pr-2">{s.present}</td>
                          <td className="py-2 pr-2">{s.absent}</td>
                          <td className="py-2 pr-2">{s.late}</td>
                          <td className="py-2 pr-2">{s.halfDay}</td>
                          <td className="py-2 pr-2">{s.odHalfDay}</td>
                          <td className="py-2 pr-2">{s.odFullDay}</td>
                          <td className="py-2 font-semibold text-indigo-700">{s.attendancePercent}%</td>
                        </tr>
                      ))
                    : report.classes.map((c) => (
                        <tr key={c.sectionId} className="border-t border-gray-100">
                          <td className="py-2 pr-3 font-medium">{c.label}</td>
                          <td className="py-2 pr-3">{c.studentCount}</td>
                          <td className="py-2 pr-2">{c.present}</td>
                          <td className="py-2 pr-2">{c.absent}</td>
                          <td className="py-2 pr-2">{c.late}</td>
                          <td className="py-2 pr-2">{c.halfDay}</td>
                          <td className="py-2 pr-2">{c.odHalfDay}</td>
                          <td className="py-2 pr-2">{c.odFullDay}</td>
                          <td className="py-2 font-semibold text-indigo-700">{c.attendancePercent}%</td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t border-gray-100 px-4 py-3 sm:px-5">
              <button
                type="button"
                onClick={dismissPdfPreview}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
              <button
                type="button"
                onClick={savePdfPreview}
                disabled={exporting}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {exporting ? <LoaderCircle size={14} className="animate-spin" /> : <Download size={14} />}
                <span className="sm:hidden">Share / Save</span>
                <span className="hidden sm:inline">Save as PDF</span>
              </button>
            </div>
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

function ReportsLanding({ onSelect, user }) {
  const showTeacherColumn = canManageTeachers(user);
  const [classesData, setClassesData] = useState([]);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [nominalTarget, setNominalTarget] = useState(null);
  const [nominalStudents, setNominalStudents] = useState([]);
  const [teacherBySection, setTeacherBySection] = useState({});
  const [nominalLoading, setNominalLoading] = useState(false);
  const [nominalError, setNominalError] = useState('');
  const [downloadingClassId, setDownloadingClassId] = useState(null);
  const [downloadNotice, setDownloadNotice] = useState('');

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

  const fetchClassStudents = async (klass) => {
    const sections = klass.sections || [];
    if (!sections.length) return [];
    const lists = await Promise.all(
      sections.map(async (sec) => {
        if (!sec?.id) {
          throw new Error(`Section ${sec?.name || '?'} is missing an id`);
        }
        const data = await getStudents({ sectionId: sec.id });
        return (data.students || []).map((s) => ({
          ...s,
          sectionName: sec.name,
        }));
      })
    );
    return lists
      .flat()
      .sort(
        (a, b) =>
          String(a.sectionName).localeCompare(String(b.sectionName)) ||
          Number(a.rollNo ?? a.roll) - Number(b.rollNo ?? b.roll)
      );
  };

  const buildTeacherMap = async (klass) => {
    if (!showTeacherColumn) return {};
    try {
      const data = await getTeachers();
      const map = {};
      const classKey = String(klass.name || '').toUpperCase();
      for (const t of data.teachers || []) {
        const parts = String(t.classesAssigned || '')
          .split(/[,;]/)
          .map((p) => p.trim())
          .filter(Boolean);
        for (const part of parts) {
          const m = part.match(/^(.+?)[\s\-–]+([A-Za-z0-9]+)$/);
          if (!m) continue;
          const grade = m[1].trim().toUpperCase();
          const sec = m[2].trim().toUpperCase();
          if (grade === classKey || formatClassLabel(grade).toUpperCase() === formatClassLabel(klass.name).toUpperCase()) {
            map[sec] = t.name;
          }
        }
      }
      return map;
    } catch {
      return {};
    }
  };

  const nominalDateLabel = () => {
    const iso = getTodayAttendanceDate();
    const d = new Date(`${iso}T12:00:00`);
    const datePart = d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    const weekday = d.toLocaleDateString('en-GB', { weekday: 'long' });
    return `${datePart}, ${weekday}`;
  };

  const sectionLabelForStudents = (students, klass) => {
    const secs = [...new Set(students.map((s) => s.sectionName).filter(Boolean))];
    if (secs.length === 1) return secs[0];
    const fromClass = (klass.sections || []).map((s) => s.name);
    if (fromClass.length === 1) return fromClass[0];
    return '';
  };

  const openNominalPdf = (klass, students, teachersMap = {}) => {
    const classLabel = formatClassLabel(klass.name);
    const sectionLabel = sectionLabelForStudents(students, klass);
    exportNominalRollPdf({
      classLabel,
      sectionLabel,
      dateLabel: nominalDateLabel(),
      showTeacherColumn,
      rows: students.map((s) => ({
        roll: s.rollNo ?? s.roll,
        name: s.name,
        section: s.sectionName,
        teacher: teachersMap[String(s.sectionName || '').toUpperCase()] || '',
      })),
    });
  };

  const loadNominalRoll = async (klass) => {
    setNominalTarget(klass);
    setNominalLoading(true);
    setNominalError('');
    setNominalStudents([]);
    setTeacherBySection({});
    setDownloadNotice('');
    try {
      const [students, teachersMap] = await Promise.all([
        fetchClassStudents(klass),
        buildTeacherMap(klass),
      ]);
      setNominalStudents(students);
      setTeacherBySection(teachersMap);
    } catch (err) {
      setNominalError(err.message || 'Failed to load nominal roll');
    } finally {
      setNominalLoading(false);
    }
  };

  const downloadNominalRoll = async (klass) => {
    const classKey = klass.id || klass.name;
    setNominalError('');
    setDownloadNotice('');
    setDownloadingClassId(classKey);
    try {
      const reuse =
        nominalTarget &&
        (nominalTarget.id || nominalTarget.name) === classKey &&
        nominalStudents.length > 0 &&
        !nominalLoading;
      const students = reuse ? nominalStudents : await fetchClassStudents(klass);
      if (!students.length) {
        setNominalError('No students to download for this class.');
        return;
      }
      const teachersMap = reuse ? teacherBySection : await buildTeacherMap(klass);
      openNominalPdf(klass, students, teachersMap);
      setDownloadNotice('Print dialog opened — choose Save as PDF.');
    } catch (err) {
      setNominalError(err.message || 'Failed to download nominal roll');
    } finally {
      setDownloadingClassId(null);
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
              Drill down school-wide attendance by standard and section, or export daily and monthly
              PDF summaries.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {REPORT_TYPES.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                if (item.id === 'attendance') {
                  window.history.pushState(null, '', '#/reports/attendance');
                }
                onSelect(item.id);
              }}
              className={`group rounded-2xl border bg-white p-5 text-left shadow-sm transition hover:shadow-md ${
                item.id === 'attendance'
                  ? 'border-indigo-300 ring-1 ring-indigo-100 hover:border-indigo-400'
                  : 'border-gray-200 hover:border-violet-300'
              }`}
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

        {nominalError && !nominalTarget ? (
          <div className="border-t border-red-100 bg-red-50 px-5 py-3 text-sm text-red-700">
            {nominalError}
          </div>
        ) : null}
        {downloadNotice && !nominalTarget ? (
          <div className="border-t border-emerald-100 bg-emerald-50 px-5 py-3 text-sm text-emerald-800">
            {downloadNotice}
          </div>
        ) : null}

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
                const classKey = klass.id || klass.name;
                const isDownloading = downloadingClassId === classKey;
                return (
                  <tr key={classKey} className="border-t border-gray-100">
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
                        disabled={Boolean(downloadingClassId)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm hover:bg-gray-50 disabled:cursor-wait disabled:opacity-60"
                      >
                        {isDownloading ? (
                          <LoaderCircle size={14} className="animate-spin" />
                        ) : (
                          <Download size={14} />
                        )}
                        {isDownloading ? 'Preparing…' : 'Download'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {nominalTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="border-b-4 border-[#1e3a8a] px-5 py-4" style={{ borderImage: 'linear-gradient(to right, #1e3a8a 0, #1e3a8a 72px, #c9a227 72px, #c9a227 144px, #1e3a8a 144px) 1' }}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                    RIOBizSols
                  </p>
                  <h3 className="text-xl font-extrabold tracking-wide text-[#1e3a8a]">
                    SCHOOL NOMINAL ROLL
                  </h3>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="rounded-full bg-[#1e3a8a] px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
                      Class {formatClassLabel(nominalTarget.name)}
                    </span>
                    {(nominalTarget.sections || []).slice(0, 3).map((s) => (
                      <span
                        key={s.id || s.name}
                        className="rounded-full bg-[#1e3a8a] px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white"
                      >
                        Section {s.name}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Date</p>
                  <p className="text-sm font-bold text-slate-900">{nominalDateLabel()}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setNominalTarget(null);
                      setDownloadNotice('');
                      setNominalError('');
                    }}
                    className="mt-2 rounded-lg px-2 py-1 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                  >
                    <X size={16} className="inline" /> Close
                  </button>
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-auto px-5 py-3">
              {nominalLoading ? (
                <p className="flex items-center justify-center gap-2 py-12 text-sm text-gray-500">
                  <LoaderCircle size={16} className="animate-spin" /> Loading students…
                </p>
              ) : null}
              {nominalError ? <p className="py-6 text-sm text-red-600">{nominalError}</p> : null}
              {!nominalLoading && !nominalError ? (
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-[#1e3a8a] text-xs font-bold uppercase tracking-wide text-white">
                      <tr>
                        {(nominalTarget.sections || []).length > 1 ? (
                          <th className="px-4 py-3">Section</th>
                        ) : null}
                        <th className="px-4 py-3 text-center">Roll No.</th>
                        <th className="px-4 py-3">Student Name</th>
                        {showTeacherColumn ? (
                          <th className="px-4 py-3">Teacher</th>
                        ) : null}
                        <th className="px-4 py-3">Remarks / Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {nominalStudents.map((s, i) => (
                        <tr
                          key={s.id}
                          className={i % 2 ? 'bg-sky-50/70' : 'bg-white'}
                        >
                          {(nominalTarget.sections || []).length > 1 ? (
                            <td className="px-4 py-2.5 text-center text-slate-600">
                              {s.sectionName}
                            </td>
                          ) : null}
                          <td className="px-4 py-2.5 text-center font-semibold text-slate-700">
                            {s.rollNo ?? s.roll}
                          </td>
                          <td className="px-4 py-2.5 font-semibold text-slate-900">{s.name}</td>
                          {showTeacherColumn ? (
                            <td className="px-4 py-2.5 text-slate-700">
                              {teacherBySection[String(s.sectionName || '').toUpperCase()] || '—'}
                            </td>
                          ) : null}
                          <td className="px-4 py-2.5 text-slate-400">&nbsp;</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
              {!nominalLoading && !nominalError && !nominalStudents.length ? (
                <p className="py-8 text-center text-sm text-gray-500">No students in this class.</p>
              ) : null}
              {!nominalLoading && !nominalError && nominalStudents.length ? (
                <div className="mt-3 flex items-start gap-2 rounded-xl bg-blue-50 px-3 py-2.5 text-xs font-semibold text-[#1e3a8a]">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#1e3a8a] text-[10px] font-bold text-white">
                    i
                  </span>
                  <span>
                    This is the nominal roll for Class {formatClassLabel(nominalTarget.name)}
                    {sectionLabelForStudents(nominalStudents, nominalTarget)
                      ? ` - Section ${sectionLabelForStudents(nominalStudents, nominalTarget)}`
                      : ''}
                    .
                  </span>
                </div>
              ) : null}
            </div>
            <div className="flex flex-col gap-2 border-t border-gray-100 px-5 py-3">
              {downloadNotice ? (
                <p className="text-sm text-emerald-700">{downloadNotice}</p>
              ) : null}
              {nominalError ? <p className="text-sm text-red-600">{nominalError}</p> : null}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => downloadNominalRoll(nominalTarget)}
                  disabled={Boolean(downloadingClassId) || nominalLoading || !nominalStudents.length}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#1e3a8a] bg-white px-3 py-2 text-sm font-medium text-[#1e3a8a] hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
                >
                  <Printer size={14} />
                  Print
                </button>
                <button
                  type="button"
                  onClick={() => downloadNominalRoll(nominalTarget)}
                  disabled={Boolean(downloadingClassId) || nominalLoading || !nominalStudents.length}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:cursor-wait disabled:opacity-60"
                >
                  {downloadingClassId === (nominalTarget.id || nominalTarget.name) ? (
                    <LoaderCircle size={14} className="animate-spin" />
                  ) : (
                    <Download size={14} />
                  )}
                  {downloadingClassId === (nominalTarget.id || nominalTarget.name)
                    ? 'Preparing…'
                    : 'Download PDF'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function ReportsPage({ user }) {
  const [activeReport, setActiveReport] = useState(() => {
    const parsed = parseAttendancePath(window.location.hash.replace(/^#/, ''));
    return parsed ? 'attendance' : null;
  });

  useEffect(() => {
    const onHash = () => {
      const parsed = parseAttendancePath(window.location.hash.replace(/^#/, ''));
      if (parsed) setActiveReport('attendance');
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  if (activeReport === 'attendance') {
    return (
      <AttendanceReportsApp
        onExit={() => {
          window.history.pushState(null, '', window.location.pathname + window.location.search);
          setActiveReport(null);
        }}
      />
    );
  }
  if (activeReport === 'daily') return <DailyReportView onBack={() => setActiveReport(null)} />;
  if (activeReport === 'monthly') return <MonthlyReportView onBack={() => setActiveReport(null)} />;

  return <ReportsLanding onSelect={setActiveReport} user={user} />;
}
