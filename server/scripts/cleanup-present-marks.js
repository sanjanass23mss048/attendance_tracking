/**
 * One-time cleanup: remove legacy daily Present rows from tblStudentAtt_list.
 * Run from server/: node scripts/cleanup-present-marks.js
 */
import { cleanupStoredPresentDailyMarks } from '../src/services/attendanceRepo.js';

const result = await cleanupStoredPresentDailyMarks();
console.log(`Deleted ${result.count} daily Present row(s) from tblStudentAtt_list.`);
