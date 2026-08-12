import { SUBJECT_STYLES } from '../data/timetableData.js';

const SUBJECT_META = [
  { name: 'English', code: 'ENG', periods: 'Language' },
  { name: 'Maths', code: 'MAT', periods: 'Core' },
  { name: 'EVS', code: 'EVS', periods: 'Primary' },
  { name: 'Hindi', code: 'HIN', periods: 'Language' },
  { name: 'Computer', code: 'CMP', periods: 'Skill' },
  { name: 'Drawing', code: 'ART', periods: 'Activity' },
  { name: 'Games', code: 'PE', periods: 'Activity' },
  { name: 'Library', code: 'LIB', periods: 'Activity' },
  { name: 'Science', code: 'SCI', periods: 'Core' },
  { name: 'Social', code: 'SST', periods: 'Core' },
];

export default function SubjectsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Subjects</h2>
        <p className="text-sm text-gray-500">
          School subjects used in timetable and homework assignment.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SUBJECT_META.map((s) => {
          const style = SUBJECT_STYLES[s.name] || 'bg-gray-50 text-gray-800 border-gray-200';
          return (
            <div
              key={s.name}
              className={`rounded-2xl border px-4 py-4 shadow-sm ${style}`}
            >
              <p className="text-xs font-bold uppercase tracking-wide opacity-70">{s.code}</p>
              <p className="mt-1 text-base font-bold">
                {s.name === 'Maths' ? 'Mathematics' : s.name}
              </p>
              <p className="mt-1 text-xs font-medium opacity-80">{s.periods}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
