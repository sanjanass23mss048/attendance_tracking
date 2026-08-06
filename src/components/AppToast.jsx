import { useEffect, useState } from 'react';
import { onToast } from '../services/toast.js';

const STYLE = {
  error: 'border-red-200 bg-red-50 text-red-800',
  success: 'border-green-200 bg-green-50 text-green-800',
  info: 'border-indigo-200 bg-indigo-50 text-indigo-900',
};

/**
 * Fixed toast stack for save / network feedback (non-blocking).
 */
export default function AppToast() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    return onToast((toast) => {
      setItems((prev) => [...prev.slice(-3), toast]);
      const id = toast.id;
      window.setTimeout(() => {
        setItems((prev) => prev.filter((t) => t.id !== id));
      }, toast.type === 'error' ? 6000 : 3500);
    });
  }, []);

  if (items.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-20 right-3 z-[100] flex max-w-sm flex-col gap-2 lg:bottom-4 lg:right-4"
      aria-live="polite"
    >
      {items.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto rounded-xl border px-4 py-3 text-sm shadow-lg ${STYLE[t.type] || STYLE.info}`}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
