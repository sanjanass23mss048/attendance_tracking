/**
 * Tamil Nadu holiday filter helpers.
 * Calendarific often returns locations: "All" for India, so we filter by name
 * for TN-relevant gazetted / common school holidays.
 */

/** Names / keywords that Tamil Nadu schools typically observe. */
export const TN_INCLUDE_KEYWORDS = [
  'republic day',
  'independence day',
  'gandhi',
  'christmas',
  'good friday',
  'diwali',
  'deepavali',
  'holi',
  'eid',
  'id-ul',
  'ramzan',
  'bakrid',
  'muharram',
  'milad',
  'pongal',
  'thai pongal',
  'puthandu',
  'tamil new year',
  'chithirai',
  'may day',
  "worker's day",
  'workers day',
  'labour day',
  'labor day',
  'ambedkar',
  'janmashtami',
  'krishna jayanthi',
  'krishna jayanti',
  'ganesh',
  'vinayaka',
  'vinayagar',
  'dussehra',
  'vijayadashami',
  'ayudha',
  'saraswati',
  'mahavir',
  'buddha',
  'guru nanak',
  'new year',
];

/** Clearly other-state / not typically TN school holidays. */
export const TN_EXCLUDE_KEYWORDS = [
  'onam',
  'gudi padwa',
  'ugadi',
  'bihu',
  'rath yatra',
  'chhat puja',
  'chhath',
  'bhai duj',
  'govardhan',
  'naraka chaturdasi',
  'karaka chaturthi',
  'halloween',
  'valentine',
  'mother\'s day',
  'father\'s day',
  'friendship day',
  'passover',
  'hanukkah',
  'lunar new year',
  'equinox',
  'solstice',
  'shivaji',
  'rabindranath',
  'vaisakhi',
  'mesadi',
  'holika dahana',
  'rama navami',
  'raksha bandhan',
  'sharad navratri',
  'durga puja',
  'maha saptami',
  'maha ashtami',
  'maharishi',
  'guru ravidas',
  'hazarat ali',
  'jamat',
  'maundy',
  'easter day',
  'christmas eve',
  'new year\'s eve',
  'first day of',
  'last day of',
];

export const HOLIDAY_STATES = [
  { id: 'ALL', label: 'All India', location: '' },
  { id: 'TN', label: 'Tamil Nadu', location: 'in-tn' },
];

export function isTamilNaduRelevantHoliday(title = '', types = [], locations = '') {
  const name = String(title).toLowerCase();
  const locs = String(locations).toLowerCase();
  const typeStr = (Array.isArray(types) ? types : [types]).join(' ').toLowerCase();

  if (locs.includes('tamil')) return true;

  if (TN_EXCLUDE_KEYWORDS.some((k) => name.includes(k))) return false;

  if (typeStr.includes('national')) return true;

  if (TN_INCLUDE_KEYWORDS.some((k) => name.includes(k))) return true;

  // Keep remaining optional only if not excluded (conservative for TN mode)
  return false;
}
