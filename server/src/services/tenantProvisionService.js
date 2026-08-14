import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';import { createPrismaClient, withPoolLimits } from '../lib/prisma.js';
import { postgresAdminUrl, urlForDatabase } from '../lib/tenantDb.js';
import { dbNameForSlug, tenantSubdomainUrl, validateSlug } from '../lib/tenantHost.js';
import {
  deleteTenantBySlug,
  findTenantByDbName,
  findTenantBySlug,
  insertTenant,
} from './tenantRegistry.js';
import { seedNewTenant } from './tenantSeedService.js';
import { ensureAttendanceStatuses } from '../lib/statusMap.js';
import { ensureAdminAuditTables } from '../lib/ensureAdminAuditTables.js';
import { ensureStudentImportTables } from '../lib/ensureStudentImportTables.js';
import { ensureTeacherNotificationTables } from '../lib/ensureTeacherNotificationTables.js';
import { tenantAls } from '../lib/tenantContext.js';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

async function databaseExists(adminClient, dbName) {
  const r = await adminClient.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [dbName]);
  return r.rowCount > 0;
}

async function applyTenantSchema(databaseUrl) {
  const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const result = spawnSync(
    npx,
    ['prisma', 'db', 'push', '--skip-generate', '--accept-data-loss'],
    {
      cwd: serverRoot,
      env: { ...process.env, DATABASE_URL: databaseUrl },
      encoding: 'utf8',
      shell: process.platform === 'win32',
    }
  );
  if (result.status !== 0) {
    const detail = [result.stderr, result.stdout].filter(Boolean).join('\n').trim();
    throw new Error(detail || 'Could not apply school database schema.');
  }
}
export async function checkSlugAvailability(rawSlug) {
  const slug = validateSlug(rawSlug);
  const dbName = dbNameForSlug(slug);
  const existing = await findTenantBySlug(slug);
  if (existing) {
    return {
      available: false,
      slug,
      databaseName: dbName,
      message: `Slug “${slug}” is already in use.`,
      slugTaken: true,
      databaseTaken: false,
    };
  }
  const byDb = await findTenantByDbName(dbName);
  if (byDb) {
    return {
      available: false,
      slug,
      databaseName: dbName,
      message: `Database ${dbName} is already registered.`,
      slugTaken: false,
      databaseTaken: true,
    };
  }

  const admin = new pg.Client({ connectionString: postgresAdminUrl() });
  try {
    await admin.connect();
    const taken = await databaseExists(admin, dbName);
    if (taken) {
      return {
        available: false,
        slug,
        databaseName: dbName,
        message: `Database ${dbName} already exists.`,
        slugTaken: false,
        databaseTaken: true,
      };
    }
  } finally {
    await admin.end().catch(() => {});
  }

  return {
    available: true,
    slug,
    databaseName: dbName,
    message: `“${slug}” is available.`,
    slugTaken: false,
    databaseTaken: false,
  };
}

export async function createSchoolTenant({
  schoolName,
  slug: rawSlug,
  city,
  board,
  includeKg = true,
  maxGrade = 12,
  admin,
} = {}) {
  const name = String(schoolName || '').trim();
  if (name.length < 2) throw new Error('School name is required.');
  if (!admin?.email || !admin?.name) {
    throw new Error('Admin name and email are required.');
  }
  const slug = validateSlug(rawSlug);
  const availability = await checkSlugAvailability(slug);
  if (!availability.available) {
    throw new Error(availability.message);
  }

  const grade = Math.min(12, Math.max(1, Number(maxGrade) || 12));
  const kg = Boolean(includeKg);
  const dbName = dbNameForSlug(slug);
  const newDbUrl = withPoolLimits(urlForDatabase(dbName));

  const adminClient = new pg.Client({ connectionString: postgresAdminUrl() });
  await adminClient.connect();
  try {
    if (await databaseExists(adminClient, dbName)) {
      throw new Error(`Database ${dbName} already exists.`);
    }
    await adminClient.query(`CREATE DATABASE "${dbName}"`);
  } finally {
    await adminClient.end().catch(() => {});
  }

  try {
    await insertTenant({
      slug,
      dbName,
      adminEmail: String(admin.email).trim().toLowerCase(),
    });

    await applyTenantSchema(newDbUrl);
    const tenantPrisma = createPrismaClient(newDbUrl);
    try {
      await tenantAls.run({ prisma: tenantPrisma, tenant: slug }, async () => {
        await ensureAttendanceStatuses();
        await ensureStudentImportTables();
        await ensureTeacherNotificationTables();
        await ensureAdminAuditTables();
        await seedNewTenant(tenantPrisma, {
          schoolName: name,
          includeKg: kg,
          maxGrade: grade,
          admin,
        });
      });
    } finally {
      await tenantPrisma.$disconnect().catch(() => {});
    }
  } catch (err) {
    try {
      await deleteTenantBySlug(slug);
    } catch (_) {
      /* ignore registry cleanup */
    }
    try {
      const drop = new pg.Client({ connectionString: postgresAdminUrl() });
      await drop.connect();
      await drop.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
      await drop.end();
    } catch (_) {
      /* ignore cleanup */
    }
    throw err;
  }

  return {
    slug,
    schoolName: name,
    database: dbName,
    maxGrade: grade,
    includeKg: kg,
    city: city?.trim() || null,
    board: board?.trim() || null,
    subdomainUrl: tenantSubdomainUrl(slug),
    adminEmail: String(admin.email).trim().toLowerCase(),
  };
}
