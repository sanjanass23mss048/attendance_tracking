import { MAY_2026_EVENTS, SCHEDULED_EVENTS, JULY_2026_DEMO_EVENTS } from '../data/calendarData';
import { INDIA_GOVT_HOLIDAYS } from '../data/indiaGovtHolidays';
import { HOLIDAY_STATES, isTamilNaduRelevantHoliday } from '../data/holidayRegions';
import { apiFetch, useMock } from './api.js';

const LOCAL_EVENTS_KEY = 'bfps_school_events_v4';
const LOCAL_SCHEDULED_KEY = 'bfps_school_scheduled_v4';
const GOVT_CACHE_PREFIX = 'bfps_govt_holidays_v5_';
const DB_MIGRATION_KEY = 'bfps_calendar_db_migrated_v1';

const COUNTRY = (import.meta.env.VITE_HOLIDAY_COUNTRY || 'IN').trim().toUpperCase();
const CALENDARIFIC_KEY = import.meta.env.VITE_CALENDARIFIC_API_KEY?.trim() || '';
const DEFAULT_STATE = (import.meta.env.VITE_HOLIDAY_STATE || 'TN').trim().toUpperCase();

const NAGER_BASE = 'https://date.nager.at/api/v3/PublicHolidays';

function pad(n) {
  return String(n).padStart(2, '0');
}

function toIsoDate(year, monthIndex, day) {
  return `${year}-${pad(monthIndex + 1)}-${pad(day)}`;
}

function eventDay(isoDate) {
  return Number(String(isoDate).slice(8, 10));
}

function seedSchoolEvents() {
  if (!localStorage.getItem(LOCAL_EVENTS_KEY)) {
    const maySeed = MAY_2026_EVENTS.map((event) => {
      let type = event.type;
      if (type === 'sudden' && event.title.includes('Annual')) type = 'event';
      return {
        id: event.id,
        date: toIsoDate(2026, 4, event.day),
        type,
        title: event.title,
        subtitle: event.subtitle || (type === 'holiday' ? 'School Holiday' : ''),
        applicable_to: event.subtitle || 'All Classes',
        parent_message: null,
        source: 'school',
      };
    });

    const julySeed = JULY_2026_DEMO_EVENTS.map((event) => ({
      id: event.id,
      date: event.date,
      type: event.type,
      title: event.title,
      subtitle: event.subtitle || '',
      applicable_to: 'All Classes',
      parent_message: null,
      source: 'school',
    }));

    localStorage.setItem(LOCAL_EVENTS_KEY, JSON.stringify([...maySeed, ...julySeed]));
  }

  if (!localStorage.getItem(LOCAL_SCHEDULED_KEY)) {
    localStorage.setItem(LOCAL_SCHEDULED_KEY, JSON.stringify(SCHEDULED_EVENTS));
  }
}

function readSchoolEvents() {
  seedSchoolEvents();
  const events = JSON.parse(localStorage.getItem(LOCAL_EVENTS_KEY) || '[]');
  // Drop mistaken sudden holiday on a normal working Friday (07 Aug 2026).
  const cleaned = events.filter(
    (e) => !(e.date === '2026-08-07' && (e.type === 'sudden' || e.source === 'sudden'))
  );
  if (cleaned.length !== events.length) {
    writeSchoolEvents(cleaned);
  }
  return cleaned;
}

function writeSchoolEvents(events) {
  localStorage.setItem(LOCAL_EVENTS_KEY, JSON.stringify(events));
}

function readSchoolScheduled() {
  seedSchoolEvents();
  return JSON.parse(localStorage.getItem(LOCAL_SCHEDULED_KEY) || '[]');
}

function writeSchoolScheduled(events) {
  localStorage.setItem(LOCAL_SCHEDULED_KEY, JSON.stringify(events));
}

function mapApiEvent(row) {
  return {
    id: row.id,
    date: row.date,
    day: eventDay(row.date),
    type: row.type,
    title: row.title,
    subtitle: row.subtitle || row.applicable_to || '',
    applicableTo: row.applicable_to || 'All Classes',
    parentMessage: row.parent_message || null,
    source: row.source || 'school',
  };
}

function toApiEventPayload(row) {
  return {
    id: row.id,
    date: row.date,
    type: row.type,
    title: row.title,
    subtitle: row.subtitle || '',
    applicable_to: row.applicable_to || row.applicableTo || 'All Classes',
    parent_message: row.parent_message ?? row.parentMessage ?? null,
    source: row.source || 'school',
  };
}

async function syncEventsToApi(events) {
  if (useMock() || !events?.length) return;
  try {
    await apiFetch('/api/calendar/sync', {
      method: 'POST',
      json: { events: events.map(toApiEventPayload) },
    });
  } catch {
    // non-fatal — localStorage remains fallback
  }
}

async function fetchApiCalendarEventsRange(from, to) {
  if (useMock()) return null;
  try {
    const data = await apiFetch(`/api/calendar/events?from=${from}&to=${to}`);
    if (!Array.isArray(data.events)) return [];
    return data.events.map(mapApiEvent);
  } catch {
    return null;
  }
}

/** One-time push of browser school events into Postgres. */
export async function migrateLocalStorageToDb() {
  if (useMock()) return;
  if (localStorage.getItem(DB_MIGRATION_KEY)) return;

  const school = readSchoolEvents();
  if (school.length === 0) {
    localStorage.setItem(DB_MIGRATION_KEY, '1');
    return;
  }

  try {
    await syncEventsToApi(school);
    localStorage.setItem(DB_MIGRATION_KEY, '1');
  } catch {
    // retry on next calendar page load
  }
}

function mapEvent(row) {
  return {
    id: row.id,
    date: row.date,
    day: eventDay(row.date),
    type: row.type,
    title: row.title,
    subtitle: row.subtitle || row.applicable_to || '',
    applicableTo: row.applicable_to || 'All Classes',
    parentMessage: row.parent_message || null,
    source: row.source || 'school',
  };
}

function mapGovtHoliday(item, source = 'govt') {
  const date = item.date;
  const title = item.localName || item.name;
  return {
    id: `govt-${date}-${title}`,
    date,
    day: eventDay(date),
    type: 'holiday',
    title,
    subtitle: source === 'calendarific' ? 'Government Holiday (Calendarific)' : 'Government Holiday',
    applicableTo: 'All Classes',
    parentMessage: null,
    source,
    global: item.global !== false,
  };
}

function getCuratedIndiaHolidays(year) {
  const list = INDIA_GOVT_HOLIDAYS[year] || [];
  return list.map((item) => mapGovtHoliday(item, 'curated'));
}

async function fetchNagerHolidays(year) {
  const response = await fetch(`${NAGER_BASE}/${year}/${COUNTRY}`);
  if (response.status === 204 || !response.ok) return [];
  const text = await response.text();
  if (!text) return [];
  const data = JSON.parse(text);
  if (!Array.isArray(data) || data.length === 0) return [];
  return data.map((item) => mapGovtHoliday(item, 'nager'));
}

async function fetchCalendarificHolidays(year, stateId = 'ALL') {
  if (!CALENDARIFIC_KEY) return [];

  const state = HOLIDAY_STATES.find((s) => s.id === stateId) || HOLIDAY_STATES[0];
  const params = new URLSearchParams({
    year: String(year),
    country: COUNTRY,
  });
  if (state.location) params.set('location', state.location);

  const response = await fetch(`/api/calendarific-holidays?${params}`);
  if (!response.ok) return [];
  const payload = await response.json();
  const holidays = payload?.response?.holidays;
  if (!Array.isArray(holidays) || holidays.length === 0) return [];

  const seen = new Set();
  let mapped = holidays
    .map((item) => {
      const types = Array.isArray(item.type) ? item.type : [];
      if (types.length === 1 && types[0] === 'Season') return null;

      let date = item.date?.iso?.slice(0, 10) || null;
      if (!date && item.date?.datetime) {
        const { year: y, month: m, day: d } = item.date.datetime;
        date = `${y}-${pad(m)}-${pad(d)}`;
      }
      if (!date) return null;

      const title = item.name || 'Holiday';
      const dedupeKey = `${date}|${title.toLowerCase()}`;
      if (seen.has(dedupeKey)) return null;
      seen.add(dedupeKey);

      const typeLabel = types.filter((t) => t !== 'Season').join(', ') || 'Holiday';
      const locations = item.locations || 'All';
      return {
        id: `govt-${date}-${title}`,
        date,
        day: eventDay(date),
        type: 'holiday',
        title,
        subtitle: typeLabel,
        applicableTo: 'All Classes',
        parentMessage: null,
        source: 'calendarific',
        global: true,
        types,
        locations,
      };
    })
    .filter(Boolean);

  if (stateId === 'TN') {
    mapped = mapped.filter((event) =>
      isTamilNaduRelevantHoliday(event.title, event.types, event.locations)
    );
  }

  return mapped;
}

/**
 * Government holidays loader:
 * 1) Calendarific first (when API key is set)
 * 2) Nager.Date
 * 3) Curated India list fallback
 * State filter (e.g. TN) applied for Calendarific results.
 */
async function fetchGovtHolidays(year, stateId = DEFAULT_STATE) {
  const mode = CALENDARIFIC_KEY ? 'calendarific' : 'free';
  const cacheKey = `${GOVT_CACHE_PREFIX}${mode}_${COUNTRY}_${stateId}_${year}`;
  const cached = localStorage.getItem(cacheKey);

  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      const ageMs = Date.now() - (parsed.fetchedAt || 0);
      if (ageMs < 24 * 60 * 60 * 1000 && Array.isArray(parsed.events) && parsed.events.length > 0) {
        return { events: parsed.events, provider: parsed.provider || 'cache', stateId };
      }
    } catch {
      // ignore
    }
  }

  let events = [];
  let provider = 'none';

  if (CALENDARIFIC_KEY) {
    try {
      events = await fetchCalendarificHolidays(year, stateId);
      if (events.length > 0) provider = 'calendarific';
    } catch {
      events = [];
    }
  }

  if (events.length === 0) {
    try {
      events = await fetchNagerHolidays(year);
      if (events.length > 0) provider = 'nager';
    } catch {
      events = [];
    }
  }

  if (events.length === 0 && COUNTRY === 'IN') {
    events = getCuratedIndiaHolidays(year);
    if (stateId === 'TN') {
      events = events.filter((event) =>
        isTamilNaduRelevantHoliday(event.title, ['National holiday'], 'All')
      );
    }
    provider = events.length > 0 ? 'curated' : 'none';
  }

  localStorage.setItem(
    cacheKey,
    JSON.stringify({ fetchedAt: Date.now(), country: COUNTRY, year, stateId, provider, events })
  );

  if (!useMock()) {
    await syncEventsToApi(events);
  }

  return { events, provider, stateId };
}

function generateSundayHolidays(year, monthIndex = null) {
  const sundays = [];
  const startMonth = monthIndex == null ? 0 : monthIndex;
  const endMonth = monthIndex == null ? 11 : monthIndex;

  for (let m = startMonth; m <= endMonth; m += 1) {
    const daysInMonth = new Date(year, m + 1, 0).getDate();
    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(year, m, day);
      if (date.getDay() !== 0) continue;
      const iso = toIsoDate(year, m, day);
      sundays.push({
        id: `sunday-${iso}`,
        date: iso,
        day,
        type: 'holiday',
        title: 'Weekly Holiday',
        subtitle: 'Sunday',
        applicableTo: 'All Classes',
        parentMessage: null,
        source: 'sunday',
        global: true,
      });
    }
  }

  return sundays;
}

export function isSundayDate(isoDate) {
  const date = new Date(`${isoDate}T12:00:00`);
  return !Number.isNaN(date.getTime()) && date.getDay() === 0;
}

function mergeEvents(lists) {
  const map = new Map();
  lists.flat().forEach((event) => {
    const key = event.id || `${event.date}-${event.type}-${event.title}`;
    map.set(key, event);
  });
  return [...map.values()].sort(
    (a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title)
  );
}

export function isCalendarificConfigured() {
  return Boolean(CALENDARIFIC_KEY);
}

export function getHolidayCountry() {
  return COUNTRY;
}

export function getCalendarDataSource() {
  if (CALENDARIFIC_KEY) return 'calendarific+sudden';
  return COUNTRY === 'IN' ? 'curated+sudden' : 'nager+sudden';
}

export function getDefaultHolidayState() {
  return DEFAULT_STATE === 'ALL' ? 'ALL' : DEFAULT_STATE;
}

export function getHolidayStates() {
  return HOLIDAY_STATES;
}

export async function getGovtHolidays(year, stateId = DEFAULT_STATE) {
  const { events } = await fetchGovtHolidays(year, stateId);
  return events;
}

export async function getGovtHolidayMeta(year, stateId = DEFAULT_STATE) {
  return fetchGovtHolidays(year, stateId);
}

export function getSchoolEvents() {
  return readSchoolEvents().map(mapEvent);
}

export async function getMonthEvents(year, monthIndex, stateId = DEFAULT_STATE) {
  const prefix = `${year}-${pad(monthIndex + 1)}-`;
  const from = `${prefix}01`;
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  const to = `${prefix}${pad(lastDay)}`;

  if (!useMock()) {
    const apiEvents = await fetchApiCalendarEventsRange(from, to);
    if (apiEvents !== null) {
      return mergeEvents([apiEvents, generateSundayHolidays(year, monthIndex)]);
    }
  }

  const [{ events: govt }, school, apiHolidays] = await Promise.all([
    fetchGovtHolidays(year, stateId),
    Promise.resolve(readSchoolEvents().map(mapEvent)),
    fetchApiHolidaysRange(from, to),
  ]);

  return mergeEvents([
    govt.filter((e) => e.date.startsWith(prefix)),
    school.filter((e) => e.date.startsWith(prefix)),
    apiHolidays,
    generateSundayHolidays(year, monthIndex),
  ]);
}

/** Load June(startYear)–April(startYear+1) events for the academic calendar PDF. */
export async function getAcademicYearEvents(startYear, stateId = DEFAULT_STATE) {
  const monthSpecs = [
    ...[5, 6, 7, 8, 9, 10, 11].map((month) => ({ year: startYear, month })),
    ...[0, 1, 2, 3].map((month) => ({ year: startYear + 1, month })),
  ];
  const batches = await Promise.all(
    monthSpecs.map(({ year, month }) => getMonthEvents(year, month, stateId))
  );
  const seen = new Set();
  const out = [];
  for (const batch of batches) {
    for (const event of batch || []) {
      const key = `${event.id || event.date}-${event.title}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(event);
    }
  }
  out.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  return out;
}

export async function getScheduledEvents(
  limit = 12,
  viewYear = new Date().getFullYear(),
  stateId = DEFAULT_STATE
) {
  const today = toIsoDate(
    new Date().getFullYear(),
    new Date().getMonth(),
    new Date().getDate()
  );

  let merged;

  if (!useMock()) {
    const from = `${viewYear}-01-01`;
    const to = `${viewYear}-12-31`;
    const apiEvents = await fetchApiCalendarEventsRange(from, to);
    if (apiEvents !== null) {
      merged = apiEvents;
    }
  }

  if (!merged) {
    const [{ events: govtView }, school] = await Promise.all([
      fetchGovtHolidays(viewYear, stateId),
      Promise.resolve(readSchoolEvents().map(mapEvent)),
    ]);
    merged = mergeEvents([govtView, school]);
  }

  const upcoming = merged
    .filter((e) => e.date >= today)
    .slice(0, limit)
    .map((e) => ({ id: e.id, date: e.date, type: e.type, title: e.title, source: e.source }));

  if (upcoming.length > 0) return upcoming;

  return merged
    .filter((e) => e.date.startsWith(`${viewYear}-`))
    .slice(0, limit)
    .map((e) => ({ id: e.id, date: e.date, type: e.type, title: e.title, source: e.source }));
}

async function fetchApiHolidaysRange(from, to) {
  if (useMock()) return [];
  try {
    const data = await apiFetch(`/api/holidays?from=${from}&to=${to}`);
    if (!Array.isArray(data.holidays)) return [];
    return data.holidays.map((h) => {
      const isSudden = h.type === 'sudden';
      return {
        id: h.id || `api-${h.date}-${h.name}`,
        date: h.date,
        day: eventDay(h.date),
        type: isSudden ? 'sudden' : 'holiday',
        title: h.name,
        subtitle: isSudden ? 'Sudden Holiday' : h.type === 'weekly' ? 'Weekly Holiday' : 'Holiday',
        applicableTo: 'All Classes',
        parentMessage: null,
        source: isSudden ? 'sudden' : 'api',
      };
    });
  } catch {
    return [];
  }
}

export async function createSuddenHoliday(payload) {
  const id = `sudden-${Date.now()}`;
  const event = {
    id,
    date: payload.date,
    type: 'sudden',
    title: payload.reason,
    subtitle: payload.applicableTo,
    applicable_to: payload.applicableTo,
    parent_message: payload.message,
    source: 'sudden',
  };

  const events = readSchoolEvents().filter(
    (item) => !(item.date === payload.date && item.type === 'sudden')
  );
  events.push(event);
  writeSchoolEvents(events);

  const scheduled = readSchoolScheduled();
  scheduled.push({
    id: `scheduled-${Date.now()}`,
    date: payload.date,
    type: 'sudden',
    title: payload.reason,
  });
  writeSchoolScheduled(scheduled);

  if (!useMock()) {
    await apiFetch('/api/calendar/events', {
      method: 'POST',
      json: toApiEventPayload(event),
    });
  }

  return mapEvent(event);
}

export async function createCalendarEvent(payload) {
  const row = {
    id: `school-${Date.now()}`,
    date: payload.date,
    type: payload.type || 'event',
    title: payload.title,
    subtitle: payload.subtitle || '',
    applicable_to: payload.applicableTo || 'All Classes',
    parent_message: payload.parentMessage || null,
    source: 'school',
  };

  // Keep localStorage as offline fallback
  const events = readSchoolEvents();
  events.push(row);
  writeSchoolEvents(events);

  if (!useMock()) {
    await apiFetch('/api/calendar/events', {
      method: 'POST',
      json: toApiEventPayload(row),
    });
  }

  return mapEvent(row);
}

export async function deleteSchoolEvent(eventId) {
  writeSchoolEvents(readSchoolEvents().filter((e) => e.id !== eventId));
  writeSchoolScheduled(readSchoolScheduled().filter((e) => e.id !== eventId));

  if (!useMock()) {
    try {
      await apiFetch(`/api/calendar/events/${encodeURIComponent(eventId)}`, {
        method: 'DELETE',
      });
    } catch {
      // localStorage already updated
    }
  }
}

async function fetchApiHolidaysForDate(isoDate) {
  if (useMock()) return false;
  try {
    const data = await apiFetch(`/api/holidays?from=${isoDate}&to=${isoDate}`);
    return Array.isArray(data.holidays) && data.holidays.length > 0;
  } catch {
    return false;
  }
}

export async function isHolidayDate(isoDate, stateId = DEFAULT_STATE) {
  if (isSundayDate(isoDate)) return true;

  if (!useMock()) {
    const apiEvents = await fetchApiCalendarEventsRange(isoDate, isoDate);
    if (apiEvents !== null) {
      return apiEvents.some(
        (e) =>
          e.type === 'holiday' ||
          e.type === 'govt' ||
          e.type === 'sudden' ||
          e.type === 'weekly'
      );
    }
  }

  const year = Number(isoDate.slice(0, 4));
  const [{ events: govt }, school, fromApi] = await Promise.all([
    fetchGovtHolidays(year, stateId).catch(() => ({ events: [] })),
    Promise.resolve(readSchoolEvents()),
    fetchApiHolidaysForDate(isoDate),
  ]);

  const fromGovt = govt.some((e) => e.date === isoDate);
  const fromSchool = school.some(
    (e) => e.date === isoDate && (e.type === 'holiday' || e.type === 'sudden')
  );
  return fromGovt || fromSchool || fromApi;
}

export async function refreshGovtHolidays(year, stateId = DEFAULT_STATE) {
  localStorage.removeItem(`${GOVT_CACHE_PREFIX}calendarific_${COUNTRY}_${stateId}_${year}`);
  localStorage.removeItem(`${GOVT_CACHE_PREFIX}free_${COUNTRY}_${stateId}_${year}`);
  return fetchGovtHolidays(year, stateId);
}
