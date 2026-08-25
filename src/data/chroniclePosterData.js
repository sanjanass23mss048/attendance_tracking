/** Chronicle poster occasions, styles, sizes, and auto-message templates. */

export const POSTER_SIZES = [
  { id: 'square', label: '1:1 Square', ratio: '1 / 1', width: 1080, height: 1080 },
  { id: 'portrait', label: '4:5 Portrait', ratio: '4 / 5', width: 1080, height: 1350 },
  { id: 'landscape', label: '16:9 Landscape', ratio: '16 / 9', width: 1920, height: 1080 },
];

export const POSTER_STYLES = [
  { id: 'patriotic', label: 'Patriotic', hint: 'Flag / national colours' },
  { id: 'elegant', label: 'Elegant', hint: 'Clean serif look' },
  { id: 'kids', label: 'Kids', hint: 'Bright & playful' },
  { id: 'minimal', label: 'Minimal', hint: 'Simple typography' },
  { id: 'festive', label: 'Festive', hint: 'Celebration energy' },
];

export const COLOR_THEMES = [
  { id: 'saffron', label: 'Saffron', primary: '#FF671F', secondary: '#046A38', accent: '#06038D' },
  { id: 'green', label: 'Green', primary: '#046A38', secondary: '#FF671F', accent: '#0f766e' },
  { id: 'blue', label: 'Blue', primary: '#1d4ed8', secondary: '#0ea5e9', accent: '#1e3a8a' },
  { id: 'navy', label: 'Navy', primary: '#1e3a5f', secondary: '#c2410c', accent: '#f8fafc' },
  { id: 'multi', label: 'Multi', primary: '#7c3aed', secondary: '#db2777', accent: '#f59e0b' },
];

export const OCCASIONS = [
  {
    id: 'independence-day',
    label: 'Independence Day',
    emoji: '🇮🇳',
    defaultStyle: 'patriotic',
    defaultColor: 'saffron',
    defaultTitle: 'Happy Independence Day',
    tagline: 'Celebrating the spirit of freedom, unity and pride.',
  },
  {
    id: 'republic-day',
    label: 'Republic Day',
    emoji: '🇮🇳',
    defaultStyle: 'patriotic',
    defaultColor: 'saffron',
    defaultTitle: 'Happy Republic Day',
    tagline: 'Honouring our Constitution and democratic values.',
  },
  {
    id: 'teachers-day',
    label: "Teachers' Day",
    emoji: '📚',
    defaultStyle: 'elegant',
    defaultColor: 'blue',
    defaultTitle: "Happy Teachers' Day",
    tagline: 'Celebrating the mentors who shape every tomorrow.',
  },
  {
    id: 'childrens-day',
    label: "Children's Day",
    emoji: '🎈',
    defaultStyle: 'kids',
    defaultColor: 'multi',
    defaultTitle: "Happy Children's Day",
    tagline: 'Joy, curiosity and endless possibilities.',
  },
  {
    id: 'christmas',
    label: 'Christmas',
    emoji: '🎄',
    defaultStyle: 'festive',
    defaultColor: 'green',
    defaultTitle: 'Merry Christmas',
    tagline: 'Peace, warmth and festive cheer.',
  },
  {
    id: 'diwali',
    label: 'Diwali',
    emoji: '🪔',
    defaultStyle: 'festive',
    defaultColor: 'saffron',
    defaultTitle: 'Happy Diwali',
    tagline: 'May light overcome darkness in every home.',
  },
  {
    id: 'pongal',
    label: 'Pongal',
    emoji: '🌾',
    defaultStyle: 'festive',
    defaultColor: 'green',
    defaultTitle: 'Happy Pongal',
    tagline: 'Gratitude for harvest, health and happiness.',
  },
  {
    id: 'onam',
    label: 'Onam',
    emoji: '🌸',
    defaultStyle: 'festive',
    defaultColor: 'green',
    defaultTitle: 'Happy Onam',
    tagline: 'Celebrating unity, culture and prosperity.',
  },
  {
    id: 'school-anniversary',
    label: 'School Anniversary',
    emoji: '🏫',
    defaultStyle: 'elegant',
    defaultColor: 'navy',
    defaultTitle: 'Happy Anniversary',
    tagline: 'Years of learning, growth and excellence.',
  },
  {
    id: 'sports-day',
    label: 'Sports Day',
    emoji: '🏅',
    defaultStyle: 'kids',
    defaultColor: 'blue',
    defaultTitle: 'Sports Day',
    tagline: 'Strength, spirit and sportsmanship.',
  },
  {
    id: 'annual-day',
    label: 'Annual Day',
    emoji: '🎭',
    defaultStyle: 'elegant',
    defaultColor: 'navy',
    defaultTitle: 'Annual Day Celebrations',
    tagline: 'A stage for talent, pride and community.',
  },
  {
    id: 'custom',
    label: 'Custom Event',
    emoji: '✨',
    defaultStyle: 'minimal',
    defaultColor: 'navy',
    defaultTitle: 'Special Announcement',
    tagline: 'A message from our school community.',
  },
];

export function getOccasion(id) {
  return OCCASIONS.find((o) => o.id === id) || OCCASIONS[0];
}

export function getColorTheme(id) {
  return COLOR_THEMES.find((c) => c.id === id) || COLOR_THEMES[3];
}

export function getPosterSize(id) {
  return POSTER_SIZES.find((s) => s.id === id) || POSTER_SIZES[0];
}

/**
 * Auto-generate title + message from occasion + school name.
 * Returns 3 message variants for “regenerate”.
 */
export function generatePosterCopy({ occasionId, schoolName, dateLabel }) {
  const occasion = getOccasion(occasionId);
  const school = schoolName || 'Our School';
  const when = dateLabel || '';

  const messages = [
    `${school} wishes all our students, parents and staff a joyful ${occasion.label}. May we continue to learn, grow and contribute towards a brighter future.`,
    `On this special ${occasion.label}${when ? ` (${when})` : ''}, ${school} extends warm wishes to our entire school family.`,
    `${occasion.tagline} — with love from ${school}.`,
  ];

  return {
    title: occasion.defaultTitle,
    tagline: occasion.tagline,
    messages,
    styleId: occasion.defaultStyle,
    colorId: occasion.defaultColor,
  };
}

export function formatPosterDate(iso) {
  if (!iso) return '';
  try {
    const d = new Date(`${iso}T12:00:00`);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return iso;
  }
}
