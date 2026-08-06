import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];
const GENDERS = ['Male', 'Female', 'Male', 'Female', 'Other'];

function dateUTC(iso) {
  return new Date(`${iso}T00:00:00.000Z`);
}

async function main() {
  const students = await prisma.student.findMany({
    include: { section: { include: { class: true } } },
    orderBy: [{ sectionId: 'asc' }, { rollNo: 'asc' }],
  });

  let updated = 0;
  for (let i = 0; i < students.length; i++) {
    const s = students[i];
    if (s.admissionNo && s.dob && s.gender) continue;

    const className = s.section?.class?.name || 'X';
    const sectionName = s.section?.name || 'X';
    const parts = s.name.trim().split(/\s+/);
    const last = parts.slice(1).join(' ') || 'Family';
    const year = 2014 + (i % 6);
    const month = String((i % 12) + 1).padStart(2, '0');
    const day = String((i % 27) + 1).padStart(2, '0');

    await prisma.student.update({
      where: { id: s.id },
      data: {
        admissionNo: s.admissionNo || `ADM${className}${sectionName}${String(s.rollNo).padStart(3, '0')}`,
        dob: s.dob || dateUTC(`${year}-${month}-${day}`),
        gender: s.gender || GENDERS[i % GENDERS.length],
        address: s.address || `${10 + (i % 40)}, Green Park, Pune`,
        bloodGroup: s.bloodGroup || BLOOD_GROUPS[i % BLOOD_GROUPS.length],
        nationality: s.nationality || 'Indian',
        motherName: s.motherName || `Mrs. ${last}`,
        fatherName: s.fatherName || `Mr. ${last}`,
        status: s.status || 'Active',
      },
    });
    updated += 1;
  }

  console.log(`Backfilled profile fields for ${updated} of ${students.length} students`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
