import { SCHOOL_GRADES, SCHOOL_SECTIONS, classSortRank } from './schoolGrades.js';

/** Demo roster size: each class-section (CS-{grade}-{A|B|C}) has this many students. */
export const STUDENTS_PER_SECTION = 40;

/** Class 1-A canonical names (rolls 1–20), aligned with legacy mockData. */
export const CLASS_1A_BASE_NAMES = [
  'Aarav Sharma',
  'Diya Singh',
  'Vihaan Mehta',
  'Anaya Gupta',
  'Reyansh Patel',
  'Ananya Iyer',
  'Karan Joshi',
  'Meera Nair',
  'Arjun Das',
  'Isha Gupta',
  'Arjun Nair',
  'Meher Bose',
  'Kabir Shah',
  'Sara Khan',
  'Rahul Verma',
  'Nisha Rao',
  'Dev Malhotra',
  'Pooja Desai',
  'Aman Trivedi',
  'Riya Choudhary',
];

const FIRST_NAMES = [
  'Aarav', 'Diya', 'Vihaan', 'Anaya', 'Reyansh', 'Ananya', 'Karan', 'Meera',
  'Arjun', 'Isha', 'Kabir', 'Sara', 'Rahul', 'Nisha', 'Dev', 'Pooja',
  'Aman', 'Riya', 'Rohit', 'Sneha', 'Aditya', 'Kavya', 'Nikhil', 'Tanya',
  'Harsh', 'Priya', 'Vivaan', 'Myra', 'Shaurya', 'Kiara', 'Ishaan', 'Avni',
  'Dhruv', 'Saanvi', 'Yash', 'Anika', 'Krish', 'Tara', 'Rudra', 'Mira',
  'Advait', 'Zara', 'Atharv', 'Navya', 'Veer', 'Ira', 'Reyansh', 'Aadhya',
  'Om', 'Kyra', 'Parth', 'Rhea', 'Kian', 'Sia', 'Arnav', 'Maya',
  'Vihaan', 'Anvi', 'Ayaan', 'Disha', 'Laksh', 'Nandini', 'Rohan', 'Simran',
  'Ved', 'Trisha', 'Neil', 'Pari', 'Jay', 'Khushi', 'Devansh', 'Ishita',
  'Manav', 'Snehal', 'Tanish', 'Yashika', 'Akash', 'Bhavya', 'Chirag', 'Deepa',
  'Eshan', 'Farah', 'Gaurav', 'Heena', 'Imran', 'Juhi', 'Kunal', 'Lata',
];

const LAST_NAMES = [
  'Sharma', 'Singh', 'Mehta', 'Gupta', 'Patel', 'Iyer', 'Joshi', 'Nair',
  'Das', 'Bose', 'Shah', 'Khan', 'Verma', 'Rao', 'Malhotra', 'Desai',
  'Trivedi', 'Choudhary', 'Kapoor', 'Reddy', 'Menon', 'Pillai', 'Banerjee', 'Saxena',
  'Aggarwal', 'Krishnan', 'Chopra', 'Mishra', 'Kulkarni', 'Naik', 'Pawar', 'Jain',
  'Bhatt', 'Shetty', 'Nambiar', 'Varma', 'Ghosh', 'Dutta', 'Sarkar', 'Mukherjee',
  'Thakur', 'Yadav', 'Pandey', 'Tripathi', 'Sinha', 'Bhatia', 'Sood', 'Khanna',
  'Arora', 'Gill', 'Sidhu', 'Rathore', 'Solanki', 'Chauhan', 'Tomar', 'Rawat',
  'Deshmukh', 'Patil', 'Kadam', 'More', 'Jadhav', 'Shinde', 'Gaikwad', 'Kale',
];

const STREETS = [
  'Green Park',
  'Lake View',
  'Sunrise Colony',
  'River Side',
  'Hill Crest',
  'Maple Avenue',
  'Palm Grove',
  'Cedar Lane',
  'Rose Garden',
  'Silver Oak',
  'Golden Heights',
  'Blue Ridge',
  'Emerald Square',
  'Lotus Enclave',
  'Pearl Residency',
];

const GENDERS = ['Male', 'Female', 'Male', 'Female', 'Other'];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

const CLASS_1A_RESERVED = new Set(CLASS_1A_BASE_NAMES);

function sectionOffset(className, sectionName) {
  const grade = Math.max(1, classSortRank(className) + 1);
  const sec = (String(sectionName || 'A').charCodeAt(0) || 65) - 65;
  return (grade - 1) * 3 + sec;
}

function nameFromPairIndex(pairIndex) {
  const firstIdx = pairIndex % FIRST_NAMES.length;
  const lastIdx = Math.floor(pairIndex / FIRST_NAMES.length) % LAST_NAMES.length;
  return `${FIRST_NAMES[firstIdx]} ${LAST_NAMES[lastIdx]}`;
}

function pickNameFromIndex(pairIndex) {
  return nameFromPairIndex(pairIndex);
}

const ROSTER_CACHE = new Map();

function buildAllRosters() {
  const globalUsed = new Set();
  const classes = SCHOOL_GRADES;
  const sections = SCHOOL_SECTIONS;
  let pairCursor = 0;

  for (const className of classes) {
    for (const sectionName of sections) {
      const roster = [];

      for (let rollNo = 1; rollNo <= STUDENTS_PER_SECTION; rollNo += 1) {
        let name;

        if (className === '1' && sectionName === 'A' && rollNo <= CLASS_1A_BASE_NAMES.length) {
          name = CLASS_1A_BASE_NAMES[rollNo - 1];
        } else {
          while (pairCursor < FIRST_NAMES.length * LAST_NAMES.length) {
            const candidate = pickNameFromIndex(pairCursor);
            pairCursor += 1;
            if (globalUsed.has(candidate)) continue;
            if (CLASS_1A_RESERVED.has(candidate)) continue;
            name = candidate;
            break;
          }
          if (!name) {
            throw new Error('Ran out of unique demo student names');
          }
        }

        globalUsed.add(name);
        roster.push({ rollNo, name });
      }

      ROSTER_CACHE.set(`${className}-${sectionName}`, roster);
    }
  }
}

buildAllRosters();

/**
 * Deterministic roster for a class-section. Rolls 1..STUDENTS_PER_SECTION.
 * Names are globally unique across all demo class-sections.
 * @param {string} className
 * @param {string} sectionName
 * @returns {{ rollNo: number, name: string }[]}
 */
export function generateSectionRoster(className, sectionName) {
  const key = `${className}-${sectionName}`;
  if (ROSTER_CACHE.has(key)) return ROSTER_CACHE.get(key);

  // Fallback for unexpected labels (e.g. mock-only class names)
  const roster = [];
  const used = new Set();
  for (let rollNo = 1; rollNo <= STUDENTS_PER_SECTION; rollNo += 1) {
    let pairIndex = sectionOffset(className, sectionName) * STUDENTS_PER_SECTION + (rollNo - 1);
    let name = nameFromPairIndex(pairIndex);
    let guard = 0;
    while ((used.has(name) || CLASS_1A_RESERVED.has(name)) && guard < 500) {
      pairIndex += 1;
      name = nameFromPairIndex(pairIndex);
      guard += 1;
    }
    used.add(name);
    roster.push({ rollNo, name });
  }
  return roster;
}

export function splitFullName(fullName) {
  const parts = fullName.trim().split(/\s+/);
  return { first: parts[0], last: parts.slice(1).join(' ') || null };
}

/**
 * Shared demo profile fields for seed + frontend mock (unique per section/roll).
 */
export function studentDemoProfile(className, sectionName, rollNo, fullName) {
  const { last } = splitFullName(fullName);
  const offset = sectionOffset(className, sectionName);
  const seed = offset * STUDENTS_PER_SECTION + rollNo;
  const year = 2014 + (seed % 6);
  const month = String((seed % 12) + 1).padStart(2, '0');
  const day = String((seed % 27) + 1).padStart(2, '0');
  const grade = Math.max(1, classSortRank(className) + 1);
  const secDigit = String(sectionName || 'A').charCodeAt(0) - 64;

  return {
    admissionNo: `ADM${className}${sectionName}${String(rollNo).padStart(3, '0')}`,
    dob: `${year}-${month}-${day}`,
    gender: GENDERS[seed % GENDERS.length],
    address: `${10 + rollNo}, ${STREETS[offset % STREETS.length]}, Pune`,
    bloodGroup: BLOOD_GROUPS[seed % BLOOD_GROUPS.length],
    nationality: 'Indian',
    motherName: last ? `Mrs. ${last}` : null,
    fatherName: last ? `Mr. ${last}` : null,
    parentPhone: `98${grade}${secDigit}${String(rollNo).padStart(3, '0')}${String(seed % 100).padStart(2, '0')}`.slice(0, 10),
    status: 'Active',
  };
}

/** Frontend mock student id (Class 1-A keeps numeric ids for legacy grids). */
export function mockStudentId(sectionId, className, sectionName, rollNo) {
  if (className === '1' && sectionName === 'A') return String(rollNo);
  return `mock-${sectionId}-${rollNo}`;
}

/** DB ids: STU-1A-1, SC-1A-1, CS-1-A */
export function dbStudentIds(className, sectionName, rollNo) {
  return {
    studentId: `STU-${className}${sectionName}-${rollNo}`,
    studentClassId: `SC-${className}${sectionName}-${rollNo}`,
    classSectionId: `CS-${className}-${sectionName}`,
  };
}
