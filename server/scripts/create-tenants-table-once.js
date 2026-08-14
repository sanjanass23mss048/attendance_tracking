import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const dbUrl = new URL(process.env.DATABASE_URL);
const dbNameArg = process.argv[2];

const adminClient = new pg.Client({
  host: dbUrl.hostname,
  port: Number(dbUrl.port || 5432),
  user: decodeURIComponent(dbUrl.username),
  password: decodeURIComponent(dbUrl.password),
  database: 'postgres',
  connectionTimeoutMillis: 15000,
});

await adminClient.connect();
const dbs = await adminClient.query(
  `SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname`,
);
console.log('Databases:', dbs.rows.map((r) => r.datname).join(', '));

const dbName =
  dbNameArg ||
  dbs.rows.find((r) => /attend.*tenant/i.test(r.datname))?.datname ||
  'Attendance_Tenants';

if (!dbs.rows.some((r) => r.datname === dbName)) {
  console.log(`Creating database ${dbName}...`);
  await adminClient.query(`CREATE DATABASE "${dbName}"`);
}
await adminClient.end();

const client = new pg.Client({
  host: dbUrl.hostname,
  port: Number(dbUrl.port || 5432),
  user: decodeURIComponent(dbUrl.username),
  password: decodeURIComponent(dbUrl.password),
  database: dbName,
  connectionTimeoutMillis: 15000,
});

const sql = fs.readFileSync(path.join(__dirname, '..', 'sql', 'attendence_tenants.sql'), 'utf8');

try {
  await client.connect();
  console.log(`Connected to ${dbName}`);
  await client.query(sql);
  const r = await client.query(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'tenants'`,
  );
  console.log('tenants table:', r.rows.length ? 'EXISTS' : 'MISSING');
  if (r.rows.length) {
    const cols = await client.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'tenants'
       ORDER BY ordinal_position`,
    );
    console.log('columns:', cols.rows.map((x) => x.column_name).join(', '));
  }
} finally {
  await client.end().catch(() => {});
}
