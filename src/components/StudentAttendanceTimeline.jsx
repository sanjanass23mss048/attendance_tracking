import { useEffect, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { getStudentAttendanceTimeline, addStudentAttendanceNote } from '../services/attendanceIntelligenceService.js';
import { showToast } from '../services/toast.js';

const TYPE_DOT = {
  attendance: 'bg-slate-400',
  leave: 'bg-sky-500',
  parent_contact: 'bg-violet-500',
  meeting: 'bg-amber-500',
  followup: 'bg-rose-500',
  note: 'bg-emerald-500',
};

export default function StudentAttendanceTimeline({ studentClassId }) {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState([]);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!studentClassId) return;
    setLoading(true);
    try {
      const data = await getStudentAttendanceTimeline(studentClassId, { days: 90 });
      setEvents(data.events || []);
    } catch (err) {
      showToast(err.message || 'Could not load timeline', 'error');
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [studentClassId]);

  const saveNote = async () => {
    const text = note.trim();
    if (!text) return;
    setSaving(true);
    try {
      await addStudentAttendanceNote(studentClassId, text);
      setNote('');
      showToast('Note added', 'success');
      await load();
    } catch (err) {
      showToast(err.message || 'Could not save note', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-gray-500">
        <LoaderCircle className="animate-spin text-violet-600" size={16} />
        Loading timeline…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
        <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">
          Add note
        </label>
        <div className="mt-2 flex gap-2">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Parent agreed to meet next week"
            className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={saving || !note.trim()}
            onClick={saveNote}
            className="rounded-lg bg-violet-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Add
          </button>
        </div>
      </div>

      {!events.length ? (
        <p className="py-6 text-center text-sm text-gray-500">No attendance history in the last 90 days.</p>
      ) : (
        <ol className="relative space-y-0 border-l border-gray-200 ml-3">
          {events.map((ev, idx) => (
            <li key={`${ev.date}-${ev.type}-${idx}`} className="relative pb-5 pl-6">
              <span
                className={`absolute -left-1.5 top-1.5 h-3 w-3 rounded-full ring-4 ring-white ${TYPE_DOT[ev.type] || 'bg-gray-400'}`}
              />
              <p className="text-xs font-semibold text-gray-400">{ev.date}</p>
              <p className="text-sm font-semibold text-gray-900">{ev.label}</p>
              {ev.meta?.by ? <p className="text-xs text-gray-500">by {ev.meta.by}</p> : null}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
