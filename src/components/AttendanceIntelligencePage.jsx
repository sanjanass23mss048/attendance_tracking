import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  LoaderCircle,
  Plus,
  Save,
  Users,
  TrendingDown,
  MessageSquareWarning,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import {
  createIntelligenceMeeting,
  getIntelligenceOverview,
  getIntelligenceThresholds,
  getMeetingPrefill,
  saveIntelligenceThresholds,
  updateIntelligenceMeeting,
} from '../services/attendanceIntelligenceService.js';
import { listAuditLogs } from '../services/auditLogService.js';
import { formatClassLabel } from '../data/schoolGrades.js';
import { showToast } from '../services/toast.js';

const TABS = [
  { id: 'alerts', label: 'Long Absence Alerts' },
  { id: 'patterns', label: 'Leave Patterns' },
  { id: 'meetings', label: 'Parent Meetings' },
  { id: 'followups', label: 'Follow-up Queue' },
  { id: 'settings', label: 'Thresholds' },
];

const THRESHOLD_FIELDS = [
  { key: 'consecutiveAbsentDays', label: 'Consecutive absent days', hint: 'Flag after this many days in a row' },
  { key: 'absentDaysIn30', label: 'Absences in last 30 days', hint: 'Flag when absences reach this count' },
  { key: 'halfDayDaysIn30', label: 'Half-days in last 30 days', hint: 'Repeated half-day / OD half-day' },
  { key: 'mondayFridayMinAbsences', label: 'Mon/Fri absences (30 days)', hint: 'Pattern detection threshold' },
  { key: 'highRiskAbsentIn30', label: 'High-risk absences (30 days)', hint: 'Marks student as High risk' },
  { key: 'pctDropLookbackMonths', label: 'Lookback months for % drop', hint: 'Compare recent vs prior window' },
  { key: 'pctDropThreshold', label: 'Attendance % drop', hint: 'Points dropped to flag (e.g. 10)' },
  { key: 'leaveWithoutLetterMin', label: 'Absences without leave letter', hint: 'In the last 30 days' },
];

function severityTone(sev) {
  if (sev === 'critical') return 'bg-rose-100 text-rose-800 border-rose-200';
  if (sev === 'high') return 'bg-orange-100 text-orange-800 border-orange-200';
  if (sev === 'medium') return 'bg-amber-100 text-amber-800 border-amber-200';
  return 'bg-slate-100 text-slate-700 border-slate-200';
}

function riskTone(risk) {
  if (risk === 'High') return 'bg-rose-100 text-rose-800';
  if (risk === 'Medium') return 'bg-amber-100 text-amber-800';
  return 'bg-slate-100 text-slate-700';
}

function statusTone(status) {
  if (status === 'Completed' || status === 'Closed') return 'bg-emerald-100 text-emerald-800';
  if (status === 'Follow-up Required') return 'bg-rose-100 text-rose-800';
  if (status === 'Scheduled') return 'bg-sky-100 text-sky-800';
  return 'bg-violet-100 text-violet-800';
}

function inputClass() {
  return 'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500';
}

function readOnlyClass() {
  return 'w-full rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-700';
}

function formatDisplayDate(iso) {
  if (!iso) return '—';
  const m = String(iso).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function resolveParentName(student) {
  return (
    student?.fatherName ||
    student?.motherName ||
    student?.guardianName ||
    student?.parentName ||
    'Parent'
  );
}

function resolveStaffName(user) {
  return user?.name || user?.displayName || user?.email?.split('@')[0] || 'Principal';
}

export default function AttendanceIntelligencePage({ initialTab = 'alerts', onNavigate, user }) {
  const [tab, setTab] = useState(initialTab);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [thresholds, setThresholds] = useState(null);
  const [savingThresholds, setSavingThresholds] = useState(false);
  const [meetingForm, setMeetingForm] = useState(null);
  const [savingMeeting, setSavingMeeting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [overview, th] = await Promise.all([
        getIntelligenceOverview(),
        getIntelligenceThresholds().catch(() => ({ thresholds: null })),
      ]);
      setData(overview);
      setThresholds(th.thresholds || th || overview?.thresholds || null);
    } catch (err) {
      showToast(err.message || 'Could not load attendance intelligence', 'error');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (initialTab) setTab(initialTab);
  }, [initialTab]);

  const openMeetingFor = async (student) => {
    const alertReason = student.headline || student.reasons?.[0] || 'Attendance concern';
    let parentName = resolveParentName(student);
    let staffName = resolveStaffName(user);
    let studentName = student.name || '';
    let className = student.className || '';
    let sectionName = student.sectionName || '';
    let studentRecordId = student.studentRecordId;

    const shouldPrefill =
      student.studentClassId && !String(student.studentClassId).startsWith('demo-');

    if (shouldPrefill) {
      try {
        const prefill = await getMeetingPrefill(student.studentClassId);
        if (prefill?.parentName) parentName = prefill.parentName;
        if (prefill?.staffName) staffName = prefill.staffName;
        if (prefill?.student) {
          studentName = prefill.student.name || studentName;
          className = prefill.student.className || className;
          sectionName = prefill.student.sectionName || sectionName;
          studentRecordId = prefill.student.studentRecordId || studentRecordId;
        }
      } catch {
        // Keep row fallbacks when prefill is unavailable.
      }
    }

    setMeetingForm({
      studentClassId: student.studentClassId,
      studentRecordId,
      studentName,
      className,
      sectionName,
      studentLabel: `${studentName} · ${formatClassLabel(className)}${sectionName ? `-${sectionName}` : ''}`,
      parentName,
      reason: alertReason,
      meetingDate: new Date().toISOString().slice(0, 10),
      staffName,
      parentMessage: '',
      followUpDate: '',
      status: 'Scheduled',
      notifyParent: true,
    });
    setTab('meetings');
  };

  const saveMeeting = async () => {
    if (!meetingForm?.studentClassId || !meetingForm.meetingDate) {
      showToast('Student and meeting date are required', 'error');
      return;
    }
    if (!meetingForm.parentMessage?.trim()) {
      showToast('Enter the message to send to the parent', 'error');
      return;
    }
    if (String(meetingForm.studentClassId).startsWith('demo-')) {
      showToast('Demo students are read-only — use real students to save meetings', 'error');
      return;
    }
    setSavingMeeting(true);
    try {
      const res = await createIntelligenceMeeting({
        studentClassId: meetingForm.studentClassId,
        studentRecordId: meetingForm.studentRecordId,
        parentName: meetingForm.parentName,
        reason: meetingForm.reason,
        meetingDate: meetingForm.meetingDate,
        staffName: meetingForm.staffName,
        discussionNotes: meetingForm.parentMessage.trim(),
        outcome: '',
        followUpDate: meetingForm.followUpDate || null,
        status: meetingForm.status,
        notifyParent: meetingForm.notifyParent !== false,
      });
      const notify = res?.notify;
      const finalStatus = res?.meeting?.status || meetingForm.status;
      if (notify?.sent > 0) {
        showToast(`Meeting saved (${finalStatus}) · parent notified`, 'success');
      } else if (meetingForm.notifyParent !== false && notify) {
        const bits = [];
        if (notify.missingPhones) bits.push('no parent phone on file');
        else if (notify.skipped && notify.reason === 'not_configured') bits.push('WhatsApp not configured');
        else if (notify.skipped) bits.push('WhatsApp skipped');
        else if (notify.failed) bits.push(notify.error || 'message failed');
        showToast(
          `Meeting saved (${finalStatus})${bits.length ? ` — parent not notified: ${bits.join(', ')}` : ''}`,
          bits.length ? 'info' : 'success'
        );
      } else {
        showToast(`Meeting saved (${finalStatus})`, 'success');
      }
      setMeetingForm(null);
      await load();
    } catch (err) {
      showToast(err.message || 'Could not save meeting', 'error');
    } finally {
      setSavingMeeting(false);
    }
  };

  const patchMeetingStatus = async (id, status) => {
    if (String(id).startsWith('demo-')) {
      showToast('Demo meetings are read-only', 'error');
      return;
    }
    try {
      await updateIntelligenceMeeting(id, { status });
      showToast('Meeting updated', 'success');
      await load();
    } catch (err) {
      showToast(err.message || 'Could not update meeting', 'error');
    }
  };

  const saveThresholds = async () => {
    setSavingThresholds(true);
    try {
      const res = await saveIntelligenceThresholds(thresholds);
      setThresholds(res.thresholds);
      showToast('Thresholds saved', 'success');
      await load();
    } catch (err) {
      showToast(err.message || 'Could not save thresholds', 'error');
    } finally {
      setSavingThresholds(false);
    }
  };

  const summary = data?.summary;

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-6 py-20 text-sm text-gray-500">
        <LoaderCircle className="animate-spin text-violet-600" size={18} />
        Analysing attendance…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {data?.demo ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <strong className="font-semibold">Demo data</strong>
          {data.asOf ? (
            <>
              {' '}
              <span className="text-amber-800">(as of {data.asOf})</span>
            </>
          ) : null}
          {' — '}
          Sample alerts for walkthroughs only. Live school attendance is used by default.
        </div>
      ) : !data?.longAbsences?.length && !data?.patterns?.length ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
          <strong className="font-semibold">Live attendance</strong>
          {' — '}
          No students currently match the long-absence or pattern thresholds
          {typeof data?.enrollmentCount === 'number'
            ? ` (${data.enrollmentCount} enrolled${
                typeof data?.markCount === 'number' ? `, ${data.markCount} marks scanned` : ''
              })`
            : ''}
          . Alerts appear here after attendance is marked.
        </div>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <button
            type="button"
            onClick={() => onNavigate?.('dashboard')}
            className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-violet-700 hover:text-violet-900"
          >
            <ArrowLeft size={15} /> Dashboard
          </button>
          <h2 className="text-2xl font-bold text-gray-900">Attendance Intelligence</h2>
          <p className="mt-1 text-sm text-gray-500">
            Long absences, leave patterns, parent meetings and follow-ups — configurable by management.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard
          icon={AlertTriangle}
          tone="rose"
          title="Long-Term Absentees"
          value={summary?.longAbsentees?.total ?? 0}
          sub={`${summary?.longAbsentees?.immediate ?? 0} require immediate attention`}
          active={tab === 'alerts'}
          onClick={() => setTab('alerts')}
        />
        <SummaryCard
          icon={Users}
          tone="violet"
          title="Parent Meetings"
          value={summary?.meetings?.today ?? 0}
          sub={`${summary?.meetings?.followups ?? 0} follow-ups pending`}
          active={tab === 'meetings'}
          onClick={() => setTab('meetings')}
        />
        <SummaryCard
          icon={TrendingDown}
          tone="amber"
          title="Attendance Patterns"
          value={summary?.patterns?.flagged ?? 0}
          sub={`${summary?.patterns?.highRisk ?? 0} high risk`}
          active={tab === 'patterns'}
          onClick={() => setTab('patterns')}
        />
      </div>

      <div className="flex gap-4 overflow-x-auto border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`-mb-px shrink-0 border-b-2 pb-2.5 text-sm font-semibold ${
              tab === t.id
                ? 'border-violet-700 text-violet-800'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'alerts' ? (
        <section className="space-y-3">
          {(data?.longAbsences || []).length === 0 ? (
            <EmptyState text="No long-absence alerts with current thresholds." />
          ) : (
            data.longAbsences.map((row) => (
              <article
                key={row.studentClassId}
                className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-bold text-gray-900">
                      {row.name}{' '}
                      <span className="text-sm font-semibold text-gray-500">
                        · {formatClassLabel(row.className)}
                        {row.sectionName ? `-${row.sectionName}` : ''}
                      </span>
                    </p>
                    <p className="mt-1 text-sm font-medium text-rose-700">🔴 {row.headline}</p>
                    <p className="mt-1 text-xs text-gray-500">
                      Last attended: {row.lastAttended || '—'} · Parent informed:{' '}
                      {row.parentInformed ? '✅' : '❌'} · Meeting required:{' '}
                      {row.meetingRequired ? '⚠️' : '—'}
                    </p>
                  </div>
                  <span className={`rounded-full border px-2.5 py-0.5 text-xs font-bold uppercase ${severityTone(row.severity)}`}>
                    {row.severity}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <ActionBtn onClick={() => onNavigate?.('students', { focusStudentId: row.studentClassId })}>
                    View Student
                  </ActionBtn>
                  <ActionBtn onClick={() => openMeetingFor(row)}>Schedule Meeting</ActionBtn>
                  <ActionBtn onClick={() => onNavigate?.('send-notification')}>Contact Parent</ActionBtn>
                </div>
              </article>
            ))
          )}
        </section>
      ) : null}

      {tab === 'patterns' ? (
        <section className="space-y-3">
          {(data?.patterns || []).length === 0 ? (
            <EmptyState text="No unusual leave patterns detected." />
          ) : (
            data.patterns.map((row) => (
              <article
                key={row.studentClassId}
                className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-bold text-gray-900">
                      {row.name} · {formatClassLabel(row.className)}
                      {row.sectionName ? `-${row.sectionName}` : ''}
                    </p>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-violet-700">
                      Attendance pattern detected
                    </p>
                    <ul className="mt-2 space-y-1 text-sm text-gray-700">
                      {row.summary.map((line) => (
                        <li key={line}>• {line}</li>
                      ))}
                    </ul>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${riskTone(row.risk)}`}>
                    Risk: {row.risk}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <ActionBtn onClick={() => openMeetingFor(row)}>Schedule Meeting</ActionBtn>
                  <ActionBtn onClick={() => onNavigate?.('students', { focusStudentId: row.studentClassId })}>
                    View Student
                  </ActionBtn>
                </div>
              </article>
            ))
          )}
        </section>
      ) : null}

      {tab === 'meetings' || tab === 'followups' ? (
        <section className="space-y-4">
          {meetingForm ? (
            <div className="rounded-2xl border border-violet-200 bg-violet-50/40 p-4">
              <h3 className="text-sm font-bold text-gray-900">
                Schedule meeting — {meetingForm.studentLabel}
              </h3>
              <p className="mt-1 text-xs text-gray-500">
                Student, parent, date and staff are filled from records. Type the WhatsApp message
                body below.
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Field label="Parent name">
                  <input className={readOnlyClass()} value={meetingForm.parentName} readOnly />
                </Field>
                <Field label="Student">
                  <input className={readOnlyClass()} value={meetingForm.studentName} readOnly />
                </Field>
                <Field label="Class">
                  <input
                    className={readOnlyClass()}
                    value={formatClassLabel(meetingForm.className) + (meetingForm.sectionName ? `-${meetingForm.sectionName}` : '')}
                    readOnly
                  />
                </Field>
                <Field label="Alert reason">
                  <input className={readOnlyClass()} value={meetingForm.reason} readOnly />
                </Field>
                <Field label="Meeting date">
                  <input
                    className={readOnlyClass()}
                    value={formatDisplayDate(meetingForm.meetingDate)}
                    readOnly
                  />
                </Field>
                <Field label="Staff / Principal">
                  <input className={readOnlyClass()} value={meetingForm.staffName} readOnly />
                </Field>
                <Field label="Message to parent" className="sm:col-span-2">
                  <textarea
                    className={inputClass()}
                    rows={4}
                    placeholder="e.g. Please meet the principal on the scheduled date regarding your ward's attendance."
                    value={meetingForm.parentMessage}
                    onChange={(e) =>
                      setMeetingForm((p) => ({ ...p, parentMessage: e.target.value }))
                    }
                  />
                  {meetingForm.notifyParent !== false ? (
                    <p className="mt-1 text-[11px] text-violet-700">
                      Sent via WhatsApp meeting template. Status stays Scheduled until you mark
                      the meeting Completed after the parent meets staff.
                    </p>
                  ) : null}
                </Field>
              </div>
              <label className="mt-3 flex items-start gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  className="mt-0.5 rounded border-gray-300 text-violet-700 focus:ring-violet-600"
                  checked={meetingForm.notifyParent !== false}
                  onChange={(e) =>
                    setMeetingForm((p) => ({ ...p, notifyParent: e.target.checked }))
                  }
                />
                <span>
                  <span className="font-semibold text-gray-900">Send message to parent</span>
                  <span className="block text-xs text-gray-500">
                    WhatsApp the parent with the school meeting template. Mark Completed only after
                    the parent meets the principal or teacher.
                  </span>
                </span>
              </label>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  disabled={savingMeeting}
                  onClick={saveMeeting}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-violet-700 px-3.5 py-2 text-sm font-semibold text-white hover:bg-violet-800 disabled:opacity-50"
                >
                  {savingMeeting ? <LoaderCircle size={15} className="animate-spin" /> : <Plus size={15} />}
                  {meetingForm.notifyParent !== false ? 'Save & notify parent' : 'Save meeting'}
                </button>
                <button
                  type="button"
                  onClick={() => setMeetingForm(null)}
                  className="rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-sm font-semibold text-gray-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}

          <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3">Meeting</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Follow-up</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(tab === 'followups' ? data?.followUps : data?.meetings || []).map((m) => (
                  <tr key={m.id} className="hover:bg-gray-50/80">
                    <td className="px-4 py-3 font-semibold text-gray-900">
                      {m.student?.name || 'Student'}
                      <span className="block text-xs font-medium text-gray-500">
                        {formatClassLabel(m.student?.className)}
                        {m.student?.sectionName ? `-${m.student.sectionName}` : ''}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{m.reason}</td>
                    <td className="px-4 py-3 text-gray-700">{m.meetingDate}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusTone(m.status)}`}>
                        {m.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{m.followUpDate || '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex flex-wrap justify-end gap-1">
                        {m.status !== 'Completed' ? (
                          <button
                            type="button"
                            onClick={() => patchMeetingStatus(m.id, 'Completed')}
                            className="rounded-lg px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                          >
                            Parent met
                          </button>
                        ) : null}
                        {m.status !== 'Follow-up Required' ? (
                          <button
                            type="button"
                            onClick={() => patchMeetingStatus(m.id, 'Follow-up Required')}
                            className="rounded-lg px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                          >
                            Follow-up
                          </button>
                        ) : null}
                        {m.status !== 'Closed' ? (
                          <button
                            type="button"
                            onClick={() => patchMeetingStatus(m.id, 'Closed')}
                            className="rounded-lg px-2 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-100"
                          >
                            Close
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
                {!(tab === 'followups' ? data?.followUps : data?.meetings || [])?.length ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-gray-500">
                      No meetings yet. Schedule one from an alert or pattern.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {tab === 'settings' ? (
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-gray-900">Alert thresholds</h3>
              <p className="text-sm text-gray-500">Configurable by management — not hard-coded.</p>
            </div>
            <button
              type="button"
              disabled={savingThresholds || !thresholds}
              onClick={saveThresholds}
              className="inline-flex items-center gap-1.5 rounded-lg bg-violet-700 px-3.5 py-2 text-sm font-semibold text-white hover:bg-violet-800 disabled:opacity-50"
            >
              {savingThresholds ? <LoaderCircle size={15} className="animate-spin" /> : <Save size={15} />}
              Save
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {THRESHOLD_FIELDS.map((f) => (
              <label key={f.key} className="block text-sm">
                <span className="mb-1 block font-medium text-gray-700">{f.label}</span>
                <input
                  type="number"
                  min={0}
                  className={inputClass()}
                  value={thresholds?.[f.key] ?? ''}
                  onChange={(e) =>
                    setThresholds((p) => ({ ...p, [f.key]: Number(e.target.value) }))
                  }
                />
                <span className="mt-1 block text-xs text-gray-500">{f.hint}</span>
              </label>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function SummaryCard({ icon: Icon, tone, title, value, sub, onClick, active }) {
  const tones = {
    rose: 'border-rose-200 bg-rose-50 text-rose-900',
    violet: 'border-violet-200 bg-violet-50 text-violet-950',
    amber: 'border-amber-200 bg-amber-50 text-amber-950',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${tones[tone]} ${
        active ? 'ring-2 ring-violet-400' : ''
      }`}
    >
      <div className="flex items-center gap-2 text-sm font-semibold opacity-80">
        <Icon size={16} />
        {title}
      </div>
      <p className="mt-2 text-3xl font-bold">{value}</p>
      <p className="mt-1 text-xs font-medium opacity-80">{sub}</p>
    </button>
  );
}

function ActionBtn({ children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
    >
      {children}
    </button>
  );
}

function EmptyState({ text }) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-12 text-center text-sm text-gray-500">
      <CheckCircle2 className="mx-auto mb-2 text-emerald-500" size={22} />
      {text}
    </div>
  );
}

function Field({ label, children, className = '' }) {
  return (
    <label className={`block text-sm ${className}`}>
      <span className="mb-1 block font-medium text-gray-600">{label}</span>
      {children}
    </label>
  );
}

/** Dashboard intelligence panel — layout aligned to admin mockup, wired to live data. */
export function IntelligenceDashboardCards({ onOpen }) {
  const [data, setData] = useState(null);
  const [activities, setActivities] = useState([]);

  useEffect(() => {
    let cancelled = false;
    getIntelligenceOverview()
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      });
    listAuditLogs({ limit: 8 })
      .then((res) => {
        if (cancelled) return;
        const rows = Array.isArray(res?.logs) ? res.logs : Array.isArray(res?.items) ? res.items : [];
        setActivities(rows.slice(0, 8));
      })
      .catch(() => {
        if (!cancelled) setActivities([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!data?.summary) return null;

  const {
    summary,
    longAbsences = [],
    meetings = [],
    followUps = [],
    patternCategories = [],
    monthlyTrend = [],
    demo = false,
  } = data;
  const pieData = patternCategories.map((c) => ({ name: c.label, value: c.count, color: c.color }));
  const trendData = monthlyTrend.filter((m) => m.pct != null);
  const monthLabel =
    new Date().toLocaleString('en-US', { month: 'short' }) || 'This month';
  const followUpCount = summary.followUps?.total ?? followUps.length;

  const fallbackActivities = [
    ...longAbsences.slice(0, 2).map((a) => ({
      id: `alert-${a.studentClassId}`,
      title: `Long absence: ${a.name}`,
      detail: a.headline,
      tone: 'rose',
      when: 'Today',
    })),
    ...meetings.slice(0, 2).map((m) => ({
      id: `meet-${m.id}`,
      title: `Meeting · ${m.student?.name || 'Student'}`,
      detail: `${m.reason} · ${m.status}`,
      tone: 'violet',
      when: m.meetingDate || '—',
    })),
  ];

  const activityRows =
    activities.length > 0
      ? activities.map((row) => ({
          id: row.id || `${row.createdOn}-${row.action}`,
          title: row.summary || row.action || row.category || 'Activity',
          detail: [row.action, row.actorName || row.actorEmail].filter(Boolean).join(' · '),
          tone: activityTone(row.category),
          when: formatActivityTime(row.createdOn),
        }))
      : fallbackActivities;

  return (
    <div className="space-y-4">
      {demo ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Showing demo intelligence data
          {data.asOf ? ` (as of ${data.asOf})` : ''} until live attendance alerts are available.
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <InsightCard
          title="Long-Term Absentees"
          value={`${summary.longAbsentees?.total ?? 0}`}
          valueHint="Students"
          sub={`${summary.longAbsentees?.immediate ?? 0} require immediate attention`}
          cta="View All"
          tone="rose"
          icon={AlertTriangle}
          onClick={() => onOpen?.('alerts')}
        />
        <InsightCard
          title="Parent Meetings"
          value={`${summary.meetings?.today ?? 0}`}
          valueHint="Today"
          sub={`${summary.meetings?.followups ?? 0} Follow-ups Pending`}
          cta="View Schedule"
          tone="sky"
          icon={Users}
          onClick={() => onOpen?.('meetings')}
        />
        <InsightCard
          title="Attendance Patterns"
          value={`${summary.patterns?.flagged ?? 0}`}
          valueHint="Students Flagged"
          sub={`${summary.patterns?.highRisk ?? 0} High Risk`}
          cta="View Analysis"
          tone="amber"
          icon={TrendingDown}
          onClick={() => onOpen?.('patterns')}
        />
        <InsightCard
          title="Follow-up Queue"
          value={`${followUpCount}`}
          valueHint="Cases"
          sub="Awaiting action"
          cta="View Queue"
          tone="emerald"
          icon={MessageSquareWarning}
          onClick={() => onOpen?.('followups')}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel
          title="Long Absence Alerts"
          footer="View All Long Absentees →"
          onFooter={() => onOpen?.('alerts')}
        >
          <div className="divide-y divide-gray-100">
            {longAbsences.slice(0, 4).map((row) => (
              <div key={row.studentClassId} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                <Avatar name={row.name} tone="rose" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-900">{row.name}</p>
                  <p className="text-xs text-gray-500">
                    {formatClassLabel(row.className)}
                    {row.sectionName ? `-${row.sectionName}` : ''}
                  </p>
                  <p className="mt-1 text-xs font-medium text-rose-700">{row.headline}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                    Last attended
                  </p>
                  <p className="text-xs font-medium text-gray-700">{row.lastAttended || '—'}</p>
                  <p className="mt-1 text-xs text-gray-500">
                    {row.parentInformed ? (
                      <span className="inline-flex items-center gap-1 text-emerald-600">
                        <CheckCircle2 size={12} /> Informed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-amber-600">
                        <Clock size={12} /> Pending
                      </span>
                    )}
                  </p>
                </div>
              </div>
            ))}
            {!longAbsences.length ? (
              <p className="py-8 text-center text-sm text-gray-500">No long-absence alerts right now.</p>
            ) : null}
          </div>
        </Panel>

        <Panel
          title="Parent–Principal Meetings"
          footer="View All Meetings →"
          onFooter={() => onOpen?.('meetings')}
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[440px] text-left text-sm">
              <thead>
                <tr className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                  <th className="pb-2 font-semibold">Student</th>
                  <th className="pb-2 font-semibold">Reason</th>
                  <th className="pb-2 font-semibold">Meeting</th>
                  <th className="pb-2 font-semibold">Status</th>
                  <th className="pb-2 font-semibold">Follow-up</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {meetings.slice(0, 4).map((m) => (
                  <tr key={m.id}>
                    <td className="py-2.5">
                      <div className="flex items-center gap-2">
                        <Avatar name={m.student?.name || 'S'} tone="sky" size="sm" />
                        <div>
                          <p className="font-semibold text-gray-900">{m.student?.name || 'Student'}</p>
                          <p className="text-[11px] text-gray-500">
                            {formatClassLabel(m.student?.className)}
                            {m.student?.sectionName ? `-${m.student.sectionName}` : ''}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 text-xs text-gray-700">{m.reason}</td>
                    <td className="py-2.5 text-xs text-gray-600">{m.meetingDate}</td>
                    <td className="py-2.5">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${statusTone(m.status)}`}
                      >
                        {m.status}
                      </span>
                    </td>
                    <td className="py-2.5 text-xs text-gray-600">{m.followUpDate || '—'}</td>
                  </tr>
                ))}
                {!meetings.length ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-sm text-gray-500">
                      No meetings scheduled yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel
          title="Leave Pattern Analysis"
          subtitle="This month"
          footer="View Detailed Analysis →"
          onFooter={() => onOpen?.('patterns')}
          className="lg:col-span-1"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative mx-auto h-40 w-40 shrink-0">
              {pieData.length ? (
                <>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={48}
                        outerRadius={68}
                        paddingAngle={2}
                      >
                        {pieData.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <p className="text-2xl font-bold text-gray-900">{summary.patterns?.flagged ?? 0}</p>
                    <p className="text-[10px] font-semibold uppercase text-gray-500">Flagged</p>
                  </div>
                </>
              ) : (
                <p className="flex h-full items-center justify-center text-sm text-gray-500">No patterns</p>
              )}
            </div>
            <ul className="min-w-0 flex-1 space-y-2">
              {pieData.map((p) => (
                <li key={p.name} className="flex items-start justify-between gap-2 text-xs text-gray-600">
                  <span className="inline-flex items-start gap-1.5">
                    <span
                      className="mt-1 h-2 w-2 shrink-0 rounded-full"
                      style={{ background: p.color }}
                    />
                    <span>{p.name}</span>
                  </span>
                  <span className="font-bold text-gray-900">{p.value}</span>
                </li>
              ))}
            </ul>
          </div>
        </Panel>

        <Panel title="Attendance Trend" subtitle="Last 6 months" className="lg:col-span-1">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="h-40 min-w-0 flex-1">
              {trendData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData}>
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} width={28} />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="pct"
                      name="Attendance %"
                      stroke="#4f46e5"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: '#4f46e5' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="flex h-full items-center justify-center text-sm text-gray-500">
                  Not enough marked days yet.
                </p>
              )}
            </div>
            <div className="flex w-full shrink-0 flex-col justify-center rounded-xl border border-violet-100 bg-violet-50 px-3 py-3 sm:w-28">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-700">
                Overall ({monthLabel})
              </p>
              <p className="mt-1 text-3xl font-bold text-violet-950">
                {summary.overallPct != null ? `${summary.overallPct}%` : '—'}
              </p>
              {summary.monthDelta != null ? (
                <p
                  className={`mt-1 text-xs font-semibold ${
                    summary.monthDelta < 0 ? 'text-rose-600' : 'text-emerald-600'
                  }`}
                >
                  {summary.monthDelta < 0 ? '▼' : '▲'} {Math.abs(summary.monthDelta)}% vs prior
                </p>
              ) : (
                <p className="mt-1 text-[10px] text-gray-500">vs prior month</p>
              )}
            </div>
          </div>
        </Panel>

        <Panel
          title="Recent Activities"
          footer="View All Activities →"
          onFooter={() => onOpen?.('alerts')}
          className="lg:col-span-1"
        >
          <ul className="space-y-3">
            {activityRows.slice(0, 5).map((item) => (
              <li key={item.id} className="flex gap-3">
                <span
                  className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${activityIconBg(item.tone)}`}
                >
                  <ActivityDot tone={item.tone} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-900">{item.title}</p>
                  {item.detail ? (
                    <p className="truncate text-xs text-gray-500">{item.detail}</p>
                  ) : null}
                </div>
                <p className="shrink-0 text-[10px] font-medium text-gray-400">{item.when}</p>
              </li>
            ))}
            {!activityRows.length ? (
              <p className="py-6 text-center text-sm text-gray-500">No recent activity yet.</p>
            ) : null}
          </ul>
        </Panel>
      </div>
    </div>
  );
}

function InsightCard({ title, value, valueHint, sub, cta, tone, icon: Icon, onClick }) {
  const themes = {
    rose: {
      wrap: 'border-rose-200 bg-gradient-to-br from-rose-50 to-white',
      icon: 'bg-rose-100 text-rose-700',
      btn: 'bg-rose-600 hover:bg-rose-700 text-white',
    },
    sky: {
      wrap: 'border-sky-200 bg-gradient-to-br from-sky-50 to-white',
      icon: 'bg-sky-100 text-sky-700',
      btn: 'bg-sky-600 hover:bg-sky-700 text-white',
    },
    amber: {
      wrap: 'border-amber-200 bg-gradient-to-br from-amber-50 to-white',
      icon: 'bg-amber-100 text-amber-800',
      btn: 'bg-amber-500 hover:bg-amber-600 text-white',
    },
    emerald: {
      wrap: 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-white',
      icon: 'bg-emerald-100 text-emerald-700',
      btn: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    },
  };
  const t = themes[tone] || themes.sky;
  return (
    <div className={`flex flex-col rounded-2xl border p-4 shadow-sm ${t.wrap}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-gray-800">{title}</p>
        <span className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${t.icon}`}>
          <Icon size={18} />
        </span>
      </div>
      <p className="mt-3 text-3xl font-bold tabular-nums text-gray-950">
        {value}
        <span className="ml-1 text-sm font-semibold text-gray-500">{valueHint}</span>
      </p>
      <p className="mt-1 text-xs font-medium text-gray-600">{sub}</p>
      <button
        type="button"
        onClick={onClick}
        className={`mt-4 inline-flex w-fit items-center rounded-lg px-3 py-1.5 text-xs font-semibold ${t.btn}`}
      >
        {cta}
      </button>
    </div>
  );
}

function Panel({ title, subtitle, children, footer, onFooter, className = '' }) {
  return (
    <div className={`rounded-2xl border border-gray-200 bg-white p-4 shadow-sm ${className}`}>
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <div>
          <h4 className="text-sm font-bold text-gray-900">{title}</h4>
          {subtitle ? <p className="text-xs text-gray-500">{subtitle}</p> : null}
        </div>
      </div>
      {children}
      {footer ? (
        <button
          type="button"
          onClick={onFooter}
          className="mt-3 text-xs font-semibold text-violet-700 hover:text-violet-900"
        >
          {footer}
        </button>
      ) : null}
    </div>
  );
}

function Avatar({ name, tone = 'violet', size = 'md' }) {
  const initial = String(name || '?')
    .trim()
    .charAt(0)
    .toUpperCase();
  const tones = {
    rose: 'bg-rose-100 text-rose-700',
    sky: 'bg-sky-100 text-sky-700',
    violet: 'bg-violet-100 text-violet-700',
  };
  const sz = size === 'sm' ? 'h-8 w-8 text-xs' : 'h-10 w-10 text-sm';
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold ${sz} ${tones[tone] || tones.violet}`}
    >
      {initial}
    </span>
  );
}

function activityTone(category) {
  const c = String(category || '').toUpperCase();
  if (c.includes('ATTEND')) return 'emerald';
  if (c.includes('MEET') || c.includes('APPROVAL')) return 'violet';
  if (c.includes('LEAVE') || c.includes('NOTICE')) return 'amber';
  if (c.includes('ALERT') || c.includes('AUTH')) return 'rose';
  return 'sky';
}

function activityIconBg(tone) {
  if (tone === 'emerald') return 'bg-emerald-100 text-emerald-700';
  if (tone === 'violet') return 'bg-violet-100 text-violet-700';
  if (tone === 'amber') return 'bg-amber-100 text-amber-800';
  if (tone === 'rose') return 'bg-rose-100 text-rose-700';
  return 'bg-sky-100 text-sky-700';
}

function ActivityDot({ tone }) {
  if (tone === 'emerald') return <CheckCircle2 size={14} />;
  if (tone === 'rose') return <AlertTriangle size={14} />;
  if (tone === 'amber') return <MessageSquareWarning size={14} />;
  return <Users size={14} />;
}

function formatActivityTime(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}
