/**
 * Upsert distinct class timetables for CS-1-A (primary) and CS-11-A (senior).
 */
import 'dotenv/config';
import { prisma } from '../src/lib/prisma.js';
import { newId } from '../src/lib/ids.js';
import {
  buildPrimaryWeeklyTimetable,
  buildSeniorWeeklyTimetable,
} from '../src/lib/defaultTimetable.js';

async function upsertGrid(sectionId, grid) {
  const existing = await prisma.tblTimetable.findUnique({
    where: { Class_Section_id: sectionId },
  });
  if (existing) {
    await prisma.tblTimetable.update({
      where: { Class_Section_id: sectionId },
      data: { Grid_Json: grid, Updated_On: new Date() },
    });
    console.log('Updated timetable', sectionId);
  } else {
    await prisma.tblTimetable.create({
      data: {
        Timetable_id: newId('TTB'),
        Class_Section_id: sectionId,
        Grid_Json: grid,
      },
    });
    console.log('Created timetable', sectionId);
  }
}

await upsertGrid('CS-1-A', buildPrimaryWeeklyTimetable());
await upsertGrid('CS-11-A', buildSeniorWeeklyTimetable());
await prisma.$disconnect();
