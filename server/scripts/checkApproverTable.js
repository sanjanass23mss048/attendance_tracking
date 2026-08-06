import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const db = await prisma.$queryRaw`SELECT current_database() AS db`;
console.log('App DB:', db);
const tables = await prisma.$queryRaw`
  SELECT table_schema, table_name
  FROM information_schema.tables
  WHERE table_name ILIKE '%approver%'
     OR table_name ILIKE '%edit_request%'
     OR table_name ILIKE '%audit_log%'
  ORDER BY 1, 2
`;
console.log('Tables found:', tables);
await prisma.$disconnect();
