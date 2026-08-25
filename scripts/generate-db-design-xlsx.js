/**
 * Generate Attendance App DB design Excel from Prisma schema + runtime tables.
 * Usage: node scripts/generate-db-design-xlsx.js
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const schemaPath = path.join(root, 'server', 'prisma', 'schema.prisma');
const outPath = path.join(root, 'docs', `Attendance_App_Database_Design_${new Date().toISOString().slice(0, 10)}.xlsx`);

const MODULES = {
  tblAttendance: 'Attendance Core',
  tblStudentAtt_list: 'Attendance Core',
  tblAttendanceStatus: 'Attendance Core',
  tblAttendance_Edit_Requests: 'Attendance Core',
  tblAttendance_Audit_Logs: 'Attendance Core',
  tblParent_Attendance_Messages: 'Attendance Core',
  tblAttendance_Meetings: 'Attendance Intelligence',
  tblAttendance_Notes: 'Attendance Intelligence',
  tblClass: 'Academics',
  tblSection: 'Academics',
  tblClass_Section: 'Academics',
  tblSubjects: 'Academics',
  tblClass_Diary: 'Academics',
  tblTimetable: 'Academics',
  tblHolidays: 'Calendar',
  tblCalendarEvents: 'Calendar',
  tblStudents: 'Students',
  tblStudent_Class: 'Students',
  tblDocuments: 'Students',
  tblStudent_Import_History: 'Students',
  tblStudent_Import_Audit: 'Students',
  tblUsers: 'Users & Staff',
  tblRoles: 'Users & Staff',
  tblTeacher_Class: 'Users & Staff',
  tblStaff_Profile: 'Users & Staff',
  tblClass_Section_Approver: 'Users & Staff',
  tblParent_Student: 'Parent Portal',
  tblDevice_Tokens: 'Parent Portal',
  tblNotices: 'Communication',
  tblNotice_Targets: 'Communication',
  tblTeacher_Notifications: 'Communication',
  tblTeacher_Notification_Recipients: 'Communication',
  tblTc_Requests: 'TC Workflow',
  tblAdmin_Audit_Logs: 'Audit & Settings',
  tblApp_Settings: 'Audit & Settings',
  tenants: 'Multi-tenant Control',
};

const PURPOSE = {
  tblAttendance: 'Daily/period attendance header (one row per class-day or subject session).',
  tblStudentAtt_list: 'Per-student mark linked to an attendance header (P/A/L/H/OH/OF).',
  tblAttendanceStatus: 'Lookup of attendance status codes and labels.',
  tblAttendance_Edit_Requests: 'Teacher request to unlock editing of past attendance.',
  tblAttendance_Audit_Logs: 'Immutable log of status changes (old → new).',
  tblParent_Attendance_Messages: 'Log of absence/late WhatsApp or parent alerts sent.',
  tblAttendance_Meetings: 'Parent–principal meetings for long absences / follow-ups.',
  tblAttendance_Notes: 'Staff notes on a student attendance timeline.',
  tblClass: 'Grade/class master (e.g. Class 1, Class 10).',
  tblSection: 'Section master (A, B, C).',
  tblClass_Section: 'Join of class + section for a school year grouping.',
  tblSubjects: 'Subject master (optional link on period attendance).',
  tblStudents: 'Student master with parent contact and address.',
  tblStudent_Class: 'Enrollment: student in a class-section with roll no.',
  tblUsers: 'Staff / admin / parent login accounts.',
  tblRoles: 'Role master (TEACHER, ADMIN, PRINCIPAL, …).',
  tblTeacher_Class: 'Teacher assignment to class-sections.',
  tblStaff_Profile: 'Extended staff profile fields.',
  tblClass_Section_Approver: 'Who approves edit requests for a class-section.',
  tblNotices: 'Parent notice board posts.',
  tblNotice_Targets: 'Audience rows for a notice (class or student).',
  tblTeacher_Notifications: 'Compose/send notification campaigns (incl. WhatsApp).',
  tblTeacher_Notification_Recipients: 'Per-student delivery rows for a notification.',
  tblParent_Student: 'Links PARENT user to student records.',
  tblDevice_Tokens: 'FCM push tokens for parent apps.',
  tblHolidays: 'School holidays (non-working days).',
  tblCalendarEvents: 'Academic calendar events.',
  tblDocuments: 'Leave letters and uploaded files.',
  tblClass_Diary: 'Class diary entries.',
  tblTimetable: 'Weekly timetable JSON per class-section.',
  tblTc_Requests: 'Transfer certificate workflow.',
  tblAdmin_Audit_Logs: 'School-wide admin audit feed.',
  tblApp_Settings: 'Key/value settings (SMS, WhatsApp, FCM, thresholds).',
  tblStudent_Import_History: 'Bulk Excel student import jobs.',
  tblStudent_Import_Audit: 'Import event audit trail.',
  tenants: 'Control-plane registry of school DBs (multi-tenant).',
};

const EXTRA_TABLES = [
  {
    name: 'tblAttendance_Meetings',
    source: 'Runtime DDL (ensureAttendanceIntelligenceTables)',
    columns: [
      ['Meeting_id', 'VARCHAR(50)', 'PK', 'Y'],
      ['student_class_id', 'VARCHAR(50)', 'FK→tblStudent_Class', 'Y'],
      ['Student_id', 'VARCHAR(50)', '', 'N'],
      ['Parent_Name', 'VARCHAR(255)', '', 'N'],
      ['Reason', 'VARCHAR(255)', '', 'Y'],
      ['Meeting_Date', 'DATE', '', 'Y'],
      ['Staff_Name', 'VARCHAR(255)', '', 'N'],
      ['Staff_User_id', 'VARCHAR(50)', '', 'N'],
      ['Discussion_Notes', 'TEXT', '', 'N'],
      ['Outcome', 'TEXT', '', 'N'],
      ['Follow_Up_Date', 'DATE', '', 'N'],
      ['Status', 'VARCHAR(40)', "default 'Requested'", 'Y'],
      ['Created_By', 'VARCHAR(50)', '', 'N'],
      ['Created_On', 'TIMESTAMPTZ', 'default NOW()', 'Y'],
      ['Updated_On', 'TIMESTAMPTZ', 'default NOW()', 'Y'],
    ],
  },
  {
    name: 'tblAttendance_Notes',
    source: 'Runtime DDL (ensureAttendanceIntelligenceTables)',
    columns: [
      ['Note_id', 'VARCHAR(50)', 'PK', 'Y'],
      ['student_class_id', 'VARCHAR(50)', 'FK→tblStudent_Class', 'Y'],
      ['Note_Text', 'TEXT', '', 'Y'],
      ['Created_By', 'VARCHAR(50)', '', 'N'],
      ['Created_By_Name', 'VARCHAR(255)', '', 'N'],
      ['Created_On', 'TIMESTAMPTZ', 'default NOW()', 'Y'],
    ],
  },
  {
    name: 'tenants',
    source: 'Control DB (ensureTenantRegistry)',
    columns: [
      ['id', 'TEXT/UUID', 'PK (implementation may vary)', 'Y'],
      ['slug', 'VARCHAR', 'Unique school subdomain slug', 'Y'],
      ['name', 'VARCHAR', 'Display name', 'Y'],
      ['database_url', 'TEXT', 'Tenant Postgres connection', 'Y'],
      ['status', 'VARCHAR', 'active/inactive', 'N'],
      ['created_at', 'TIMESTAMPTZ', '', 'N'],
    ],
  },
];

function mapType(line) {
  const db = line.match(/@db\.(\w+)(?:\((\d+)\))?/);
  if (db) {
    const t = db[1].toUpperCase();
    return db[2] ? `${t}(${db[2]})` : t;
  }
  if (/\bJson\b/.test(line)) return 'JSONB';
  if (/\bBoolean\b/.test(line)) return 'BOOLEAN';
  if (/\bInt\b/.test(line)) return 'INTEGER';
  if (/\bDateTime\b/.test(line)) return 'TIMESTAMPTZ';
  if (/\bString\b/.test(line)) return 'TEXT';
  return '';
}

function parseSchema(text) {
  const models = [];
  const modelRe = /model\s+(\w+)\s*\{([^}]+)\}/gs;
  let m;
  while ((m = modelRe.exec(text))) {
    const name = m[1];
    const body = m[2];
    const columns = [];
    const fks = [];
    const indexes = [];
    const lines = body.split('\n').map((l) => l.trim()).filter(Boolean);

    for (const line of lines) {
      if (line.startsWith('@@')) {
        indexes.push(line);
        continue;
      }
      if (line.startsWith('//') || line.startsWith('///')) continue;

      const rel = line.match(/^(\w+)\s+(\w+)(\??|\[\])?\s+@relation\((.+)\)/);
      if (rel && /fields:\s*\[/.test(rel[4])) {
        const fields = (rel[4].match(/fields:\s*\[([^\]]+)\]/) || [])[1];
        const refs = (rel[4].match(/references:\s*\[([^\]]+)\]/) || [])[1];
        fks.push({
          fromTable: name,
          fromCols: fields?.replace(/\s/g, '') || '',
          toTable: rel[2],
          toCols: refs?.replace(/\s/g, '') || '',
          onDelete: (rel[4].match(/onDelete:\s*(\w+)/) || [])[1] || '',
        });
        continue;
      }
      // Skip pure relation array fields without @db
      if (/^\w+\s+\w+(\??|\[\])(\s+@relation)?/.test(line) && !/@db\.|@id|@unique|@default/.test(line) && !/\bString\b|\bInt\b|\bDateTime\b|\bBoolean\b|\bJson\b/.test(line)) {
        continue;
      }
      if (/^\w+\s+\w+(\??|\[\])/.test(line) && !/@db\.|@id|@unique|@default|String|Int|DateTime|Boolean|Json/.test(line.split(/\s+/).slice(0, 3).join(' '))) {
        // relation-only
        if (!line.includes('@db') && !line.includes('@id') && !line.match(/\b(String|Int|DateTime|Boolean|Json)\b/)) continue;
      }

      const colMatch = line.match(/^(\w+)\s+(String|Int|DateTime|Boolean|Json)(\?)?/);
      if (!colMatch) continue;
      const col = colMatch[1];
      const optional = Boolean(colMatch[3]);
      const isPk = /@id\b/.test(line);
      const isUnique = /@unique\b/.test(line);
      const def = (line.match(/@default\(([^)]+)\)/) || [])[1] || '';
      columns.push({
        column: col,
        dataType: mapType(line) || colMatch[2].toUpperCase(),
        nullable: optional && !isPk ? 'Y' : 'N',
        pk: isPk ? 'Y' : 'N',
        unique: isUnique || isPk ? 'Y' : 'N',
        default: def,
        notes: '',
      });
    }
    models.push({ name, columns, fks, indexes, source: 'Prisma schema' });
  }
  return models;
}

function aoaToSheet(rows) {
  return XLSX.utils.aoa_to_sheet(rows);
}

function main() {
  const schema = fs.readFileSync(schemaPath, 'utf8');
  const models = parseSchema(schema);

  // Merge extra tables not fully in prisma as models (intelligence meetings may be DDL-only)
  for (const extra of EXTRA_TABLES) {
    if (models.some((m) => m.name === extra.name)) continue;
    models.push({
      name: extra.name,
      source: extra.source,
      columns: extra.columns.map(([column, dataType, notes, nullable]) => ({
        column,
        dataType,
        nullable: nullable || 'N',
        pk: /PK/i.test(notes) ? 'Y' : 'N',
        unique: /PK/i.test(notes) ? 'Y' : 'N',
        default: '',
        notes,
      })),
      fks: [],
      indexes: [],
    });
  }

  const overview = [
    ['Attendance Tracking — Database Design'],
    ['Generated', new Date().toISOString().slice(0, 10)],
    ['Source', 'server/prisma/schema.prisma + runtime ensure* DDL'],
    ['Engine', 'PostgreSQL (multi-tenant: one DB per school + control tenants registry)'],
    [],
    ['Architecture notes'],
    ['1', 'Each school tenant has its own Postgres database with the same table set.'],
    ['2', 'Control plane table "tenants" maps subdomain slug → DATABASE_URL.'],
    ['3', 'Attendance mark flow: tblAttendance (header) → tblStudentAtt_list (rows) → tblAttendanceStatus.'],
    ['4', 'Statuses used in app: P Present, A Absent, L Late, H Half Day, OH OD Half, OF OD Full.'],
    ['5', 'Historical edits go through tblAttendance_Edit_Requests + tblAttendance_Audit_Logs.'],
    ['6', 'Intelligence meetings/notes may be created via ensure DDL on first use per tenant.'],
    [],
    ['Module', 'Tables'],
  ];

  const byModule = {};
  for (const m of models) {
    const mod = MODULES[m.name] || 'Other';
    if (!byModule[mod]) byModule[mod] = [];
    byModule[mod].push(m.name);
  }
  for (const [mod, tables] of Object.entries(byModule).sort()) {
    overview.push([mod, tables.join(', ')]);
  }

  const catalog = [
    ['Table Name', 'Module', 'Purpose', 'Source', 'Column Count'],
  ];
  for (const m of models.sort((a, b) => a.name.localeCompare(b.name))) {
    catalog.push([
      m.name,
      MODULES[m.name] || 'Other',
      PURPOSE[m.name] || '',
      m.source,
      m.columns.length,
    ]);
  }

  const columnsSheet = [
    ['Table', 'Column', 'Data Type', 'PK', 'Unique', 'Nullable', 'Default', 'Notes / FK'],
  ];
  for (const m of models.sort((a, b) => a.name.localeCompare(b.name))) {
    for (const c of m.columns) {
      const fkNote = m.fks
        .filter((f) => f.fromCols.split(',').includes(c.column))
        .map((f) => `FK → ${f.toTable}(${f.toCols})`)
        .join('; ');
      columnsSheet.push([
        m.name,
        c.column,
        c.dataType,
        c.pk,
        c.unique,
        c.nullable,
        c.default,
        [c.notes, fkNote].filter(Boolean).join(' '),
      ]);
    }
  }

  const relSheet = [['From Table', 'From Column(s)', 'To Table', 'To Column(s)', 'On Delete']];
  for (const m of models) {
    for (const f of m.fks) {
      relSheet.push([f.fromTable, f.fromCols, f.toTable, f.toCols, f.onDelete]);
    }
  }
  // Manual FKs for DDL tables
  relSheet.push(['tblAttendance_Meetings', 'student_class_id', 'tblStudent_Class', 'student_class_id', '']);
  relSheet.push(['tblAttendance_Notes', 'student_class_id', 'tblStudent_Class', 'student_class_id', '']);

  const idxSheet = [['Table', 'Index / Constraint Definition']];
  for (const m of models) {
    for (const ix of m.indexes) {
      idxSheet.push([m.name, ix]);
    }
  }

  const flowSheet = [
    ['Flow', 'Step', 'Table(s)', 'Description'],
    ['Mark Attendance', '1', 'tblClass_Section + tblStudent_Class', 'Load roster for class-section'],
    ['Mark Attendance', '2', 'tblAttendance', 'Create/find header for Attendance_Date (+ optional Subject_id)'],
    ['Mark Attendance', '3', 'tblStudentAtt_list + tblAttendanceStatus', 'Upsert each student Status_id / Session / Remarks'],
    ['Mark Attendance', '4', 'tblParent_Attendance_Messages', 'Optionally notify parents for A/L etc.'],
    ['Edit Past Day', '1', 'tblAttendance_Edit_Requests', 'Teacher requests unlock; approver PENDING→APPROVED'],
    ['Edit Past Day', '2', 'tblStudentAtt_list', 'Teacher changes statuses within Edit_Expires_At'],
    ['Edit Past Day', '3', 'tblAttendance_Audit_Logs', 'Record Old_Status → New_Status'],
    ['Send Notification', '1', 'tblTeacher_Notifications', 'Create SENT/DRAFT/SCHEDULED campaign'],
    ['Send Notification', '2', 'tblTeacher_Notification_Recipients', 'Expand audience to student_class rows'],
    ['Send Notification', '3', 'tblNotices + tblNotice_Targets', 'Mirror to parent notice board'],
    ['Send Notification', '4', 'Parent phones on tblStudents', 'WhatsApp blast using App Settings credentials'],
    ['Intelligence', '1', 'tblStudentAtt_list (scan)', 'Compute long absences / patterns'],
    ['Intelligence', '2', 'tblAttendance_Meetings / Notes', 'Track parent meetings & staff notes'],
    ['Intelligence', '3', 'tblApp_Settings', 'ATTENDANCE_INTELLIGENCE_THRESHOLDS JSON'],
  ];

  const statusSheet = [
    ['Code', 'Meaning', 'Used In'],
    ['P', 'Present', 'tblAttendanceStatus / marks'],
    ['A', 'Absent', 'tblAttendanceStatus / marks'],
    ['L', 'Late', 'tblAttendanceStatus / marks'],
    ['H', 'Half Day', 'tblAttendanceStatus / marks'],
    ['OH', 'OD Half Day', 'tblAttendanceStatus / marks'],
    ['OF', 'OD Full Day', 'tblAttendanceStatus / marks'],
    ['PENDING', 'Edit request awaiting approval', 'tblAttendance_Edit_Requests.Status'],
    ['APPROVED', 'Edit window granted', 'tblAttendance_Edit_Requests.Status'],
    ['DENIED', 'Edit request denied', 'tblAttendance_Edit_Requests.Status'],
    ['SENT / DRAFT / SCHEDULED', 'Notification lifecycle', 'tblTeacher_Notifications.status'],
    ['Requested / Scheduled / Completed / Follow-up Required / Closed', 'Meeting lifecycle', 'tblAttendance_Meetings.Status'],
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, aoaToSheet(overview), '01_Overview');
  XLSX.utils.book_append_sheet(wb, aoaToSheet(catalog), '02_Tables_Catalog');
  XLSX.utils.book_append_sheet(wb, aoaToSheet(columnsSheet), '03_Columns');
  XLSX.utils.book_append_sheet(wb, aoaToSheet(relSheet), '04_Relationships');
  XLSX.utils.book_append_sheet(wb, aoaToSheet(idxSheet), '05_Indexes');
  XLSX.utils.book_append_sheet(wb, aoaToSheet(flowSheet), '06_Key_Flows');
  XLSX.utils.book_append_sheet(wb, aoaToSheet(statusSheet), '07_Status_Codes');

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  XLSX.writeFile(wb, outPath);
  console.log(`Wrote ${outPath}`);
  console.log(`Tables: ${models.length}, Column rows: ${columnsSheet.length - 1}`);
}

main();
