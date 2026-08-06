import { useState } from 'react';
import { Grid3x3, Hash, LayoutList, MoreHorizontal, PieChart, Mail } from 'lucide-react';

const PRIMARY = [
  { id: 'grid', label: 'Grid View', short: 'Grid', icon: Grid3x3 },
  { id: 'roll', label: 'Roll Quick Entry', short: 'Roll', icon: Hash },
  { id: 'list', label: 'List View', short: 'List', icon: LayoutList },
];

const MORE_VIEWS = [
  { id: 'summary', label: 'Summary', icon: PieChart },
  { id: 'messages', label: 'Messages', icon: Mail },
];

export default function ViewModeTabs({ activeView, onChange }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = MORE_VIEWS.some((v) => v.id === activeView);

  return (
    <div className="relative">
      {/* Mobile: compact pill row matching phone mock */}
      <div className="flex gap-1.5 overflow-x-auto rounded-2xl border border-gray-200 bg-white p-1.5 shadow-sm lg:hidden">
        {PRIMARY.map(({ id, short, icon: Icon }) => {
          const isActive = activeView === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => {
                setMoreOpen(false);
                onChange(id);
              }}
              className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Icon size={14} />
              {short}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreOpen((v) => !v)}
          className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
            moreActive || moreOpen
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <MoreHorizontal size={14} />
          More
        </button>
      </div>

      {moreOpen && (
        <div className="absolute right-0 top-full z-20 mt-1 w-44 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg lg:hidden">
          {MORE_VIEWS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                onChange(id);
                setMoreOpen(false);
              }}
              className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm ${
                activeView === id
                  ? 'bg-indigo-50 font-semibold text-indigo-700'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Desktop: full tab strip */}
      <div className="hidden flex-wrap gap-1 rounded-xl border border-gray-200 bg-white p-1.5 shadow-sm lg:flex">
        {[...PRIMARY, ...MORE_VIEWS].map(({ id, label, icon: Icon }) => {
          const isActive = activeView === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-sm ring-1 ring-indigo-600'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Icon size={16} />
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
