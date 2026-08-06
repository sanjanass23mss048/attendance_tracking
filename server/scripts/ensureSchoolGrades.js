/**
 * Ensure LKG, UKG, Classes 1–12 exist with sections A, B, C.
 * Safe to re-run — upserts structure only (does not create demo students).
 *
 * Usage: node scripts/ensureSchoolGrades.js
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { SCHOOL_GRADES, SCHOOL_SECTIONS } from '../../src/data/schoolGrades.js';

const prisma = new PrismaClient();

async function main() {
  console.log('Ensuring school grades LKG / UKG / 1–12 with sections A, B, C…');

  for (const name of SCHOOL_SECTIONS) {
    await prisma.tblSection.upsert({
      where: { Section_id: `SEC-${name}` },
      create: { Section_id: `SEC-${name}`, Section_Name: name, Int_Status: 1 },
      update: { Section_Name: name, Int_Status: 1 },
    });
  }

  let createdClasses = 0;
  let createdLinks = 0;

  for (const className of SCHOOL_GRADES) {
    const classId = `CLS-${className}`;
    const existing = await prisma.tblClass.findUnique({ where: { Class_id: classId } });
    if (!existing) {
      await prisma.tblClass.create({
        data: {
          Class_id: classId,
          Class_Name: className,
          Academic_Year: '2025-26',
        },
      });
      createdClasses += 1;
    } else if (existing.Class_Name !== className) {
      await prisma.tblClass.update({
        where: { Class_id: classId },
        data: { Class_Name: className },
      });
    }

    for (const sectionName of SCHOOL_SECTIONS) {
      const csId = `CS-${className}-${sectionName}`;
      const link = await prisma.tblClass_Section.findUnique({
        where: { Class_Section_id: csId },
      });
      if (!link) {
        await prisma.tblClass_Section.create({
          data: {
            Class_Section_id: csId,
            Class_id: classId,
            Section_id: `SEC-${sectionName}`,
            int_status: 1,
          },
        });
        createdLinks += 1;
      } else if (link.int_status === 0) {
        await prisma.tblClass_Section.update({
          where: { Class_Section_id: csId },
          data: { int_status: 1 },
        });
      }
    }
  }

  const classCount = await prisma.tblClass.count();
  const linkCount = await prisma.tblClass_Section.count({ where: { int_status: 1 } });
  console.log(
    `Done. Classes total: ${classCount} (+${createdClasses} new). Active class-sections: ${linkCount} (+${createdLinks} new).`
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
