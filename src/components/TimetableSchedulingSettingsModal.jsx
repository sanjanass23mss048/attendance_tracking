import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import {
  DEFAULT_TIMETABLE_SETTINGS,
  normalizeTimetableSettings,
} from '../data/timetableScheduling.js';

const ALL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function TimetableSchedulingSettingsModal({ open, settings, onClose, onSave, saving }) {
  const [form, setForm] = useState(() => normalizeTimetableSettings(settings || DEFAULT_TIMETABLE_SETTINGS));

  useEffect(() => {
    if (open) setForm(normalizeTimetableSettings(settings || DEFAULT_TIMETABLE_SETTINGS));
  }, [open, settings]);

  if (!open) return null;

  const toggleDay = (day) => {
    setForm((prev) => {
      const has = prev.workingDays.includes(day);
      const workingDays = has
        ? prev.workingDays.filter((d) => d !== day)
        : [...prev.workingDays, day];
      const ordered = ALL_DAYS.filter((d) => workingDays.includes(d));
      return { ...prev, workingDays: ordered.length ? ordered : ['Monday'] };
    });
  };

  const updateBreak = (idx, patch) => {
    setForm((prev) => {
      const breaks = prev.breaks.map((b, i) => (i === idx ? { ...b, ...patch } : b));
      return { ...prev, breaks };
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" role="dialog">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close" onClick={onClose} />
      <div className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-gray-200 bg-white shadow-xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h3 className="text-base font-bold text-gray-900">View Settings</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <label className="block text-xs font-medium text-gray-500">
            Start time
            <input
              type="time"
              value={form.startTime}
              onChange={(e) => setForm((p) => ({ ...p, startTime: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-medium text-gray-500">
              Periods
              <input
                type="number"
                min={1}
                max={12}
                value={form.periodCount}
                onChange={(e) =>
                  setForm((p) => ({ ...p, periodCount: Number(e.target.value) || 1 }))
                }
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-xs font-medium text-gray-500">
              Duration (minutes)
              <input
                type="number"
                min={20}
                max={120}
                value={form.periodDurationMinutes}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    periodDurationMinutes: Number(e.target.value) || 45,
                  }))
                }
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
              />
            </label>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-gray-500">Working days</p>
            <div className="flex flex-wrap gap-1.5">
              {ALL_DAYS.map((day) => {
                const on = form.workingDays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
                      on ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-gray-600'
                    }`}
                  >
                    {day.slice(0, 3)}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-medium text-gray-500">Breaks / Lunch</p>
              <button
                type="button"
                onClick={() =>
                  setForm((p) => ({
                    ...p,
                    breaks: [
                      ...p.breaks,
                      {
                        afterPeriod: Math.min(p.periodCount - 1, 3),
                        label: 'Break',
                        durationMinutes: 15,
                      },
                    ],
                  }))
                }
                className="text-xs font-semibold text-indigo-700 hover:text-indigo-900"
              >
                + Add break
              </button>
            </div>
            <div className="space-y-2">
              {form.breaks.map((b, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 rounded-xl border border-gray-100 bg-slate-50 p-2">
                  <label className="text-[10px] text-gray-500">
                    After P
                    <input
                      type="number"
                      min={1}
                      max={form.periodCount - 1}
                      value={b.afterPeriod}
                      onChange={(e) => updateBreak(idx, { afterPeriod: Number(e.target.value) })}
                      className="mt-0.5 w-full rounded-lg border border-gray-200 px-2 py-1 text-sm"
                    />
                  </label>
                  <label className="text-[10px] text-gray-500">
                    Label
                    <input
                      value={b.label}
                      onChange={(e) => updateBreak(idx, { label: e.target.value })}
                      className="mt-0.5 w-full rounded-lg border border-gray-200 px-2 py-1 text-sm"
                    />
                  </label>
                  <label className="text-[10px] text-gray-500">
                    Mins
                    <input
                      type="number"
                      min={5}
                      max={120}
                      value={b.durationMinutes}
                      onChange={(e) =>
                        updateBreak(idx, { durationMinutes: Number(e.target.value) || 15 })
                      }
                      className="mt-0.5 w-full rounded-lg border border-gray-200 px-2 py-1 text-sm"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setForm((p) => ({ ...p, breaks: p.breaks.filter((_, i) => i !== idx) }))
                    }
                    className="self-end rounded-lg px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => onSave(normalizeTimetableSettings(form))}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
