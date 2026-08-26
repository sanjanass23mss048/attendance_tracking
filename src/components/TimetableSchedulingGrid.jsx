import { X } from 'lucide-react';
import {
  cellHasContent,
  initialsFromName,
  isBreakSlot,
  slotTypeClass,
} from '../data/timetableScheduling.js';

export default function TimetableSchedulingGrid({
  days,
  periods,
  grid,
  canEdit,
  onDropCell,
  onClearCell,
  highlightTeacherId,
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr className="bg-[#1e1b4b] text-white">
            <th className="sticky left-0 z-10 min-w-[108px] bg-[#1e1b4b] px-3 py-3 text-left text-xs font-semibold tracking-wide">
              Day / Period
            </th>
            {(periods || []).map((slot, pi) => (
              <th
                key={isBreakSlot(slot) ? `b-${pi}` : `p-${slot.period}`}
                className={`min-w-[120px] px-2 py-2.5 text-center ${
                  isBreakSlot(slot) ? 'bg-orange-500 text-white' : ''
                }`}
              >
                <div className="text-sm font-bold leading-tight">
                  {isBreakSlot(slot) ? slot.label || 'Short Break' : `P${slot.period}`}
                </div>
                <div
                  className={`mt-0.5 whitespace-nowrap text-[10px] font-normal leading-tight ${
                    isBreakSlot(slot) ? 'text-orange-50' : 'text-indigo-200'
                  }`}
                >
                  {slot.time}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(days || []).map((day, dayIndex) => (
            <tr key={day} className="border-t border-gray-100">
              <td className="sticky left-0 z-10 bg-white px-3 py-2.5 text-sm font-bold text-slate-800">
                {day.slice(0, 3)}
              </td>
              {(periods || []).map((slot, pi) => {
                if (isBreakSlot(slot)) {
                  return (
                    <td
                      key={`b-${day}-${pi}`}
                      className="bg-orange-50 px-2 py-2 text-center align-middle"
                    >
                      <span className="text-[11px] font-semibold text-orange-600">
                        {slot.label || 'Short Break'}
                      </span>
                    </td>
                  );
                }
                const cell = grid?.[pi]?.[dayIndex];
                const filled = cellHasContent(cell);
                const hl =
                  highlightTeacherId &&
                  (cell?.teacherId === highlightTeacherId ||
                    (cell?.teacherId == null && false));
                return (
                  <td
                    key={`c-${day}-${pi}`}
                    onDragOver={(e) => {
                      if (!canEdit) return;
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'copy';
                    }}
                    onDrop={(e) => {
                      if (!canEdit) return;
                      e.preventDefault();
                      let payload = null;
                      try {
                        payload = JSON.parse(
                          e.dataTransfer.getData('application/x-timetable-drag') || ''
                        );
                      } catch {
                        payload = null;
                      }
                      if (payload) onDropCell(pi, dayIndex, payload);
                    }}
                    className={`px-1.5 py-1.5 align-top ${hl ? 'bg-yellow-50' : ''}`}
                  >
                    {filled ? (
                      <div
                        className={`group relative rounded-xl border px-2 py-1.5 ${slotTypeClass(
                          cell.slotType || 'teacher'
                        )}`}
                      >
                        {canEdit ? (
                          <button
                            type="button"
                            aria-label="Clear slot"
                            onClick={() => onClearCell(pi, dayIndex)}
                            className="absolute -right-1 -top-1 hidden rounded-full bg-white p-0.5 text-gray-500 shadow group-hover:block hover:text-rose-600"
                          >
                            <X size={12} />
                          </button>
                        ) : null}
                        <div className="flex items-start gap-1.5">
                          {cell.teacher || cell.teacherId ? (
                            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white">
                              {initialsFromName(cell.teacher)}
                            </span>
                          ) : null}
                          <span className="min-w-0">
                            {cell.teacher ? (
                              <span className="block truncate text-[11px] font-bold leading-tight">
                                {cell.teacher}
                              </span>
                            ) : null}
                            <span className="block truncate text-[11px] font-semibold leading-tight opacity-90">
                              {cell.subject || cell.slotType || '—'}
                            </span>
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div
                        className={`flex min-h-[56px] items-center justify-center rounded-xl border border-dashed border-gray-300 bg-slate-50 text-[11px] font-medium text-gray-400 ${
                          canEdit ? 'hover:border-indigo-300 hover:bg-indigo-50/50 hover:text-indigo-400' : ''
                        }`}
                      >
                        {canEdit ? 'Drop here' : '—'}
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
