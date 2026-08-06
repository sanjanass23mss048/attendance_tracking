import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { ATTENDANCE_STATUS } from '../data/mockData';
import { normalizeStatus } from '../utils/attendance';

const statusStyles = {
  P: 'bg-green-500 text-white hover:bg-green-600',
  A: 'bg-red-500 text-white hover:bg-red-600',
  L: 'bg-amber-400 text-gray-900 hover:bg-amber-500',
  H: 'bg-violet-500 text-white hover:bg-violet-600',
  OH: 'bg-cyan-500 text-white hover:bg-cyan-600',
  OF: 'bg-teal-700 text-white hover:bg-teal-800',
  _: 'bg-gray-200 text-gray-600 hover:bg-gray-300',
};

const dividerStyles = {
  P: 'bg-green-400/80',
  A: 'bg-red-400/80',
  L: 'bg-amber-300/90',
  H: 'bg-violet-400/80',
  OH: 'bg-cyan-400/80',
  OF: 'bg-teal-500/80',
  _: 'bg-gray-300',
};

const EXTRA_OPTIONS = [
  { value: 'H', label: 'Half Day' },
  { value: 'L', label: 'Late' },
  { value: 'OH', label: 'OD - Half Day' },
  { value: 'OF', label: 'OD - Full Day' },
];

const SHORT_LABELS = new Set(['Present', 'Absent', 'Late', 'Half Day', 'Select status']);

const MENU_GAP = 4;
const MENU_EST_HEIGHT = 168;
const MENU_Z_INDEX = 10050;

function getMenuPortalContainer(anchorEl) {
  const fullscreenEl = document.fullscreenElement;
  if (fullscreenEl && anchorEl && fullscreenEl.contains(anchorEl)) {
    return (
      fullscreenEl.querySelector('[data-attendance-menu-portal]') || fullscreenEl
    );
  }
  // Always mount to body in normal mode so overflow/scroll parents cannot clip or shift the menu.
  return document.body;
}

function computeMenuPlacement(anchor, menuHeight = MENU_EST_HEIGHT) {
  const rect = anchor.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom - MENU_GAP;
  const spaceAbove = rect.top - MENU_GAP;
  const openUpward = spaceBelow < menuHeight && spaceAbove > spaceBelow;
  const width = Math.max(rect.width, 140);
  const maxLeft = Math.max(8, window.innerWidth - width - 8);
  const left = Math.min(Math.max(8, rect.left), maxLeft);

  return {
    openUpward,
    style: {
      position: 'fixed',
      left,
      width,
      top: openUpward ? undefined : rect.bottom + MENU_GAP,
      bottom: openUpward ? window.innerHeight - rect.top + MENU_GAP : undefined,
      zIndex: MENU_Z_INDEX,
    },
  };
}

/**
 * Unified split button for attendance status.
 * - Main (label) click: Half/Late/OD → Present; Present ↔ Absent
 * - Chevron opens menu with Half Day / Late / OD Half / OD Full
 */
export default function AttendanceMarkControls({ status, onChange, disabled = false, compact = false }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState(null);
  const [openUpward, setOpenUpward] = useState(false);
  const [portalTick, setPortalTick] = useState(0);
  const rootRef = useRef(null);
  const menuRef = useRef(null);
  const normalized = normalizeStatus(status);
  const isMarked = Boolean(ATTENDANCE_STATUS[normalized]);
  const current = isMarked
    ? ATTENDANCE_STATUS[normalized]
    : { label: 'Select status', color: 'bg-gray-200', text: 'text-gray-600' };
  const styleKey = isMarked ? normalized : '_';
  const showFullLabel = SHORT_LABELS.has(current.label);

  const updateMenuPosition = useCallback(() => {
    const anchor = rootRef.current;
    if (!anchor) return;

    const menuHeight = menuRef.current?.offsetHeight ?? MENU_EST_HEIGHT;
    const { openUpward: shouldOpenUp, style } = computeMenuPlacement(anchor, menuHeight);
    setOpenUpward(shouldOpenUp);
    setMenuStyle(style);
  }, []);

  useLayoutEffect(() => {
    if (!menuOpen) {
      setMenuStyle(null);
      return;
    }

    updateMenuPosition();
    const frame = requestAnimationFrame(() => updateMenuPosition());
    return () => cancelAnimationFrame(frame);
  }, [menuOpen, updateMenuPosition]);

  useEffect(() => {
    if (!menuOpen) return;

    const handleOutsideClick = (e) => {
      if (rootRef.current?.contains(e.target)) return;
      if (menuRef.current?.contains(e.target)) return;
      setMenuOpen(false);
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };

    const handleReposition = () => updateMenuPosition();
    const handleFullscreenChange = () => {
      setPortalTick((t) => t + 1);
      updateMenuPosition();
    };

    // Defer so the same click that opened the menu does not immediately close it.
    const outsideClickTimer = window.setTimeout(() => {
      document.addEventListener('click', handleOutsideClick, true);
    }, 0);

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);

    return () => {
      window.clearTimeout(outsideClickTimer);
      document.removeEventListener('click', handleOutsideClick, true);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
    };
  }, [menuOpen, updateMenuPosition]);

  const handleMainClick = () => {
    if (disabled) return;
    setMenuOpen(false);
    if (!isMarked) {
      onChange('P');
      return;
    }
    if (normalized === 'H' || normalized === 'L' || normalized === 'OH' || normalized === 'OF') {
      onChange('P');
      return;
    }
    onChange(normalized === 'A' ? 'P' : 'A');
  };

  const handleChevronClick = (e) => {
    e.stopPropagation();
    if (disabled) return;

    if (menuOpen) {
      setMenuOpen(false);
      return;
    }

    const anchor = rootRef.current;
    if (anchor) {
      const { openUpward: shouldOpenUp, style } = computeMenuPlacement(anchor);
      setOpenUpward(shouldOpenUp);
      setMenuStyle(style);
    }
    setMenuOpen(true);
  };

  const handleSelectExtra = (value) => {
    if (disabled) return;
    onChange(value);
    setMenuOpen(false);
  };

  const portalContainer = menuOpen ? getMenuPortalContainer(rootRef.current) : document.body;
  void portalTick;

  return (
    <div className="relative" ref={rootRef}>
      <div
        className={`flex w-full overflow-hidden shadow-sm disabled:opacity-60 ${statusStyles[styleKey]} ${
          compact ? 'rounded-md' : 'rounded-lg'
        } ${disabled ? 'opacity-60' : ''}`}
      >
        <button
          type="button"
          disabled={disabled}
          onClick={handleMainClick}
          className={`min-w-0 flex-1 text-left font-bold transition-colors disabled:cursor-not-allowed ${
            compact ? 'px-2 py-1.5 text-xs leading-tight' : 'px-2 py-2 text-xs'
          }`}
          title="Click to toggle Present / Absent"
        >
          <span className={showFullLabel ? 'block whitespace-nowrap' : 'block truncate'}>
            {current.label}
          </span>
        </button>

        <span className={`w-px self-stretch ${dividerStyles[styleKey]}`} aria-hidden="true" />

        <button
          type="button"
          disabled={disabled}
          onClick={handleChevronClick}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label="More status options"
          className={`flex shrink-0 items-center justify-center transition-colors disabled:cursor-not-allowed ${
            compact ? 'px-1.5 py-1.5' : 'px-2 py-2'
          }`}
          title="Half Day, Late, OD Half Day, or OD Full Day"
        >
          <ChevronDown
            size={compact ? 13 : 14}
            className={`pointer-events-none transition-transform ${menuOpen ? (openUpward ? '' : 'rotate-180') : ''}`}
          />
        </button>
      </div>

      {menuOpen &&
        !disabled &&
        menuStyle &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={menuStyle}
            className="pointer-events-auto overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
          >
            {EXTRA_OPTIONS.map((opt) => {
              const isActive = normalized === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="menuitem"
                  onClick={() => handleSelectExtra(opt.value)}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold transition-colors hover:bg-gray-50 ${
                    isActive ? 'bg-gray-50 text-gray-900' : 'text-gray-700'
                  }`}
                >
                  <span
                    className={`inline-flex h-5 min-w-5 items-center justify-center rounded px-0.5 text-[10px] font-bold text-white ${ATTENDANCE_STATUS[opt.value].color}`}
                  >
                    {opt.value}
                  </span>
                  {opt.label}
                </button>
              );
            })}
          </div>,
          portalContainer
        )}
    </div>
  );
}
