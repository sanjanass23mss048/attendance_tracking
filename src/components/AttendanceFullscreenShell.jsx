import { useCallback, useEffect, useRef, useState } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';

/**
 * Wraps the attendance workspace with a panel header and browser fullscreen toggle
 * (same idea as expand-corners icon on list panels).
 */
export default function AttendanceFullscreenShell({ title = 'Attendance', children }) {
  const panelRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => {
      const el = panelRef.current;
      setIsFullscreen(Boolean(el && document.fullscreenElement === el));
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const el = panelRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement === el) {
        await document.exitFullscreen();
      } else if (!document.fullscreenElement) {
        await el.requestFullscreen();
      } else {
        await document.exitFullscreen();
        await el.requestFullscreen();
      }
    } catch (err) {
      console.warn('Fullscreen unavailable:', err);
      alert('Fullscreen is not available in this browser.');
    }
  }, []);

  return (
    <div
      ref={panelRef}
      className={`flex min-h-0 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm ${
        isFullscreen ? 'h-screen rounded-none border-0 bg-gray-50' : ''
      }`}
    >
      <div className="flex items-center justify-between border-b border-gray-200 bg-gray-100 px-4 py-2.5">
        <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
        <button
          type="button"
          onClick={toggleFullscreen}
          className="rounded-md p-1.5 text-gray-500 hover:bg-white hover:text-indigo-600"
          title={isFullscreen ? 'Exit full screen' : 'Full screen'}
          aria-label={isFullscreen ? 'Exit full screen' : 'Full screen'}
        >
          {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
        </button>
      </div>

      <div
        className={`min-h-0 flex-1 space-y-5 overflow-y-auto ${
          isFullscreen ? 'p-6' : 'p-0'
        }`}
      >
        {children}
      </div>
    </div>
  );
}
