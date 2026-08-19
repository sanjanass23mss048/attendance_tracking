/**
 * Attendance % for reports:
 * - Full-day Absent (A) counts as 1.0 day missed
 * - Half Day (H) counts as 0.5 day missed
 * - Late and OD (OH/OF) count as fully attending
 */
export function attendancePercentFromCounts(counts) {
  const present = counts.P ?? counts.present ?? 0;
  const absent = counts.A ?? counts.absent ?? 0;
  const late = counts.L ?? counts.late ?? 0;
  const halfDay = counts.H ?? counts.halfDay ?? 0;
  const odHalf = counts.OH ?? counts.odHalfDay ?? 0;
  const odFull = counts.OF ?? counts.odFullDay ?? 0;
  const marked = present + absent + late + halfDay + odHalf + odFull;
  if (!marked) return 0;
  const missed = absent + halfDay * 0.5;
  const attending = Math.max(0, marked - missed);
  return Math.round((attending / marked) * 1000) / 10;
}
