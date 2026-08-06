/** Canonical school grades for Bright Future attendance. */
export const SCHOOL_GRADES = [
  'LKG',
  'UKG',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  '11',
  '12',
];

export const SCHOOL_SECTIONS = ['A', 'B', 'C'];

/** Sort key: LKG → UKG → 1…12 → anything else. */
export function classSortRank(name) {
  const key = String(name ?? '')
    .trim()
    .toUpperCase()
    .replace(/^CLASS\s+/i, '');
  if (key === 'LKG') return 0;
  if (key === 'UKG') return 1;
  if (/^\d+$/.test(key)) return 1 + Number(key);
  return 1000 + key.charCodeAt(0);
}

export function compareClassNames(a, b) {
  const ra = classSortRank(a);
  const rb = classSortRank(b);
  if (ra !== rb) return ra - rb;
  return String(a).localeCompare(String(b));
}

/** Dropdown / UI label: "LKG", "UKG", "Class 1", … */
export function formatClassLabel(className) {
  const text = String(className ?? '').trim();
  if (!text) return text;
  const upper = text.toUpperCase();
  if (upper === 'LKG' || upper === 'UKG') return upper;
  if (/^\d+$/.test(text)) return `Class ${text}`;
  if (/^class\s+/i.test(text)) return text;
  return `Class ${text}`;
}
