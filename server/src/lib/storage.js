import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Root folder for uploaded files (override with UPLOAD_DIR). */
export const UPLOAD_ROOT =
  process.env.UPLOAD_DIR || path.resolve(__dirname, '../../uploads');

export async function ensureUploadDir() {
  await fs.mkdir(UPLOAD_ROOT, { recursive: true });
}

export function sanitizeFileName(name) {
  const base = path.basename(name || 'file');
  return base.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200) || 'file';
}

export function storageKeyFor(entityType, entityId, documentId, fileName) {
  const safe = sanitizeFileName(fileName);
  return `${entityType}/${entityId}/${documentId}/${safe}`;
}

export function absolutePath(storageKey) {
  const resolved = path.resolve(UPLOAD_ROOT, storageKey);
  if (!resolved.startsWith(path.resolve(UPLOAD_ROOT))) {
    throw new Error('Invalid storage path');
  }
  return resolved;
}

export async function saveFile(storageKey, buffer) {
  const full = absolutePath(storageKey);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, buffer);
}

export async function deleteFile(storageKey) {
  try {
    await fs.unlink(absolutePath(storageKey));
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
}

export async function readFile(storageKey) {
  return fs.readFile(absolutePath(storageKey));
}
