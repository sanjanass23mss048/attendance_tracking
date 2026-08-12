/**
 * Align Ved (STU-11A-1) with Aarav Sharma family details + rename to Ved Sharma.
 * DOB → 2005-02-05
 */
import 'dotenv/config';
import { prisma } from '../src/lib/prisma.js';

const AARAV_ID = 'STU-1A-1';
const VED_ID = 'STU-11A-1';

const aarav = await prisma.tblStudents.findUnique({ where: { Student_id: AARAV_ID } });
if (!aarav) {
  console.error('Aarav not found', AARAV_ID);
  process.exit(1);
}

console.log('Aarav source:', {
  First_Name: aarav.First_Name,
  Last_Name: aarav.Last_Name,
  Father_Name: aarav.Father_Name,
  Mother_Name: aarav.Mother_Name,
  Father_Number: aarav.Father_Number,
  Mother_Number: aarav.Mother_Number,
  Guardian_Name: aarav.Guardian_Name,
  Guardian_Number: aarav.Guardian_Number,
  Address_Line_1: aarav.Address_Line_1,
  Address_Line_2: aarav.Address_Line_2,
  City: aarav.City,
  State: aarav.State,
  Pin_Code: aarav.Pin_Code,
  Country: aarav.Country,
});

const updated = await prisma.tblStudents.update({
  where: { Student_id: VED_ID },
  data: {
    First_Name: 'Ved',
    Last_Name: 'Sharma',
    Father_Name: aarav.Father_Name,
    Mother_Name: aarav.Mother_Name,
    Father_Number: aarav.Father_Number,
    Mother_Number: aarav.Mother_Number,
    Guardian_Name: aarav.Guardian_Name,
    Guardian_Number: aarav.Guardian_Number,
    Alternative_Number: aarav.Alternative_Number,
    Address_Line_1: aarav.Address_Line_1,
    Address_Line_2: aarav.Address_Line_2,
    City: aarav.City,
    State: aarav.State,
    Pin_Code: aarav.Pin_Code,
    Country: aarav.Country,
    DOB: new Date('2005-02-05'),
  },
});

console.log('Updated Ved:', {
  Student_id: updated.Student_id,
  name: `${updated.First_Name} ${updated.Last_Name}`,
  Father_Name: updated.Father_Name,
  Mother_Name: updated.Mother_Name,
  Father_Number: updated.Father_Number,
  Mother_Number: updated.Mother_Number,
  Address_Line_1: updated.Address_Line_1,
  City: updated.City,
  State: updated.State,
  Pin_Code: updated.Pin_Code,
  DOB: updated.DOB,
});

await prisma.$disconnect();
