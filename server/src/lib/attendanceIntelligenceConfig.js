import { Prisma } from '@prisma/client';
import { prisma } from './prisma.js';
import {
  ensureAppSettingsTable,
  invalidateAppSettingsCache,
  loadAppSettings,
} from './appSettings.js';

export const INTELLIGENCE_SETTING_KEY = 'ATTENDANCE_INTELLIGENCE_THRESHOLDS';

export const MEETING_STATUSES = [
  'Requested',
  'Scheduled',
  'Completed',
  'Follow-up Required',
  'Closed',
];

/** Configurable thresholds — management can change via the Intelligence page. */
export const DEFAULT_INTELLIGENCE_THRESHOLDS = {
  consecutiveAbsentDays: 3,
  absentDaysIn30: 5,
  halfDayDaysIn30: 4,
  mondayFridayMinAbsences: 3,
  highRiskAbsentIn30: 7,
  pctDropLookbackMonths: 3,
  pctDropThreshold: 10,
  leaveWithoutLetterMin: 3,
};

export function parseIntelligenceThresholds(raw) {
  let parsed = {};
  if (raw && typeof raw === 'object') parsed = raw;
  else if (typeof raw === 'string' && raw.trim()) {
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = {};
    }
  }
  const n = (key, fallback) => {
    const v = Number(parsed?.[key]);
    return Number.isFinite(v) && v >= 0 ? Math.round(v) : fallback;
  };
  return {
    consecutiveAbsentDays: n('consecutiveAbsentDays', DEFAULT_INTELLIGENCE_THRESHOLDS.consecutiveAbsentDays),
    absentDaysIn30: n('absentDaysIn30', DEFAULT_INTELLIGENCE_THRESHOLDS.absentDaysIn30),
    halfDayDaysIn30: n('halfDayDaysIn30', DEFAULT_INTELLIGENCE_THRESHOLDS.halfDayDaysIn30),
    mondayFridayMinAbsences: n(
      'mondayFridayMinAbsences',
      DEFAULT_INTELLIGENCE_THRESHOLDS.mondayFridayMinAbsences
    ),
    highRiskAbsentIn30: n('highRiskAbsentIn30', DEFAULT_INTELLIGENCE_THRESHOLDS.highRiskAbsentIn30),
    pctDropLookbackMonths: n(
      'pctDropLookbackMonths',
      DEFAULT_INTELLIGENCE_THRESHOLDS.pctDropLookbackMonths
    ),
    pctDropThreshold: n('pctDropThreshold', DEFAULT_INTELLIGENCE_THRESHOLDS.pctDropThreshold),
    leaveWithoutLetterMin: n(
      'leaveWithoutLetterMin',
      DEFAULT_INTELLIGENCE_THRESHOLDS.leaveWithoutLetterMin
    ),
  };
}

export async function getIntelligenceThresholds() {
  const map = await loadAppSettings();
  return parseIntelligenceThresholds(map[INTELLIGENCE_SETTING_KEY]);
}

export async function saveIntelligenceThresholds(next, updatedBy = null) {
  const cleaned = parseIntelligenceThresholds(next);
  await ensureAppSettingsTable();
  const now = new Date();
  await prisma.$executeRaw(
    Prisma.sql`INSERT INTO "tblApp_Settings" ("setting_key", "setting_value", "updated_at", "updated_by")
     VALUES (${INTELLIGENCE_SETTING_KEY}, ${JSON.stringify(cleaned)}, ${now}, ${updatedBy})
     ON CONFLICT ("setting_key") DO UPDATE
       SET "setting_value" = EXCLUDED."setting_value",
           "updated_at" = EXCLUDED."updated_at",
           "updated_by" = EXCLUDED."updated_by"`
  );
  invalidateAppSettingsCache();
  await loadAppSettings({ force: true });
  return cleaned;
}
