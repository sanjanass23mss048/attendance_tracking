import { Grid3x3, Hash, LayoutList, PieChart } from 'lucide-react';

const ALL_VIEWS = [
  { id: 'grid', label: 'Grid View', short: 'Grid View', icon: Grid3x3 },
  { id: 'roll', label: 'Roll Quick Entry', short: '# Roll Quick Entry', icon: Hash },
  { id: 'list', label: 'List View', short: 'List View', icon: LayoutList },
  { id: 'summary', label: 'Summary', short: 'Summary', icon: PieChart },
];

export default function ViewModeTabs({ activeView, onChange }) {
  return (
    <div className="relative">
      {/* Mobile: scrollable pills matching mock */}
      <div className="flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] lg:hidden [&::-webkit-scrollbar]:hidden">
        {ALL_VIEWS.map(({ id, short, icon: Icon }) => {
          const isActive = activeView === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition-colors ${
                isActive
                  ? 'bg-[#1e3a8a] text-white shadow-sm'
                  : 'border border-gray-200 bg-white text-gray-600'
              }`}
            >
              <Icon size={14} />
              {short}
            </button>
          );
        })}
      </div>

      {/* Desktop: full tab strip */}
      <div className="hidden flex-wrap gap-1 rounded-xl border border-gray-200 bg-white p-1.5 shadow-sm lg:flex">
        {ALL_VIEWS.map(({ id, label, icon: Icon }) => {
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
