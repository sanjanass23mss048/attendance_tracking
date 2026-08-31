import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { UPLOAD_ROOT } from './storage.js';
import { APEX_TENANT } from './tenantHost.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));

const LOGO_NAMES = ['logo.png', 'logo.jpg', 'logo.jpeg', 'logo.webp'];
const MIME_EXT = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};
const EXT_MIME = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

export const LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const LOGO_MIME_TYPES = Object.keys(MIME_EXT);

export function brandingSlug(slug) {
  const raw = String(slug || APEX_TENANT)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_');
  return raw || APEX_TENANT;
}

export function brandingDir(slug) {
  return path.join(UPLOAD_ROOT, 'branding', brandingSlug(slug));
}

function mimeFromFileName(fileName) {
  const ext = String(fileName || '')
    .split('.')
    .pop()
    .toLowerCase();
  return EXT_MIME[ext] || 'image/png';
}

export async function saveSchoolLogo(slug, buffer, mimeType, meta = {}) {
  const ext = MIME_EXT[String(mimeType || '').toLowerCase()];
  if (!ext) throw new Error('School logo must be a PNG, JPEG, or WebP image.');
  if (!buffer?.length) throw new Error('School logo file is empty.');
  if (buffer.length > LOGO_MAX_BYTES) throw new Error('School logo must be 2 MB or smaller.');

  const dir = brandingDir(slug);
  await fs.mkdir(dir, { recursive: true });
  await Promise.all(
    [...LOGO_NAMES, 'branding.json'].map((name) =>
      fs.unlink(path.join(dir, name)).catch(() => {})
    )
  );

  const fileName = `logo.${ext}`;
  await fs.writeFile(path.join(dir, fileName), buffer);
  const json = {
    schoolName: meta.schoolName ? String(meta.schoolName).trim() || null : null,
    fileName,
    mimeType,
    updatedAt: Date.now(),
  };
  await fs.writeFile(path.join(dir, 'branding.json'), JSON.stringify(json));
  return json;
}

export async function readBranding(slug) {
  const dir = brandingDir(slug);
  try {
    const raw = await fs.readFile(path.join(dir, 'branding.json'), 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed?.fileName) return parsed;
  } catch {
    // fall through and look for a logo file
  }
  for (const name of LOGO_NAMES) {
    try {
      const st = await fs.stat(path.join(dir, name));
      return {
        schoolName: null,
        fileName: name,
        mimeType: mimeFromFileName(name),
        updatedAt: st.mtimeMs,
      };
    } catch {
      // try next name
    }
  }
  return null;
}

export async function readLogoFile(slug) {
  const info = await readBranding(slug);
  if (!info?.fileName) return null;
  try {
    const buffer = await fs.readFile(path.join(brandingDir(slug), info.fileName));
    return {
      buffer,
      mimeType: info.mimeType || mimeFromFileName(info.fileName),
      updatedAt: info.updatedAt || Date.now(),
    };
  } catch {
    return null;
  }
}

async function readDefaultLogoFile() {
  const candidates = [
    path.resolve(HERE, '../../../public/attendance-logo.png'),
    path.resolve(HERE, '../../../dist/attendance-logo.png'),
    path.resolve(HERE, '../../public/attendance-logo.png'),
    path.resolve(process.cwd(), '../public/attendance-logo.png'),
    path.resolve(process.cwd(), '../dist/attendance-logo.png'),
    path.resolve(process.cwd(), 'public/attendance-logo.png'),
  ];
  for (const file of candidates) {
    try {
      const buffer = await fs.readFile(file);
      if (buffer.length) return { buffer, mimeType: 'image/png' };
    } catch {
      // try next path
    }
  }
  return null;
}

/** Data URL for embedding the school logo on print documents (TC, etc.). */
export async function readLogoDataUrl(slug) {
  const file = (await readLogoFile(slug)) || (await readDefaultLogoFile());
  if (!file?.buffer?.length) return null;
  const mime = file.mimeType || 'image/png';
  return `data:${mime};base64,${file.buffer.toString('base64')}`;
}

export function brandingPublicInfo(slug, info) {
  if (!info?.fileName) {
    return { tenant: brandingSlug(slug), hasLogo: false, schoolName: null, logoUrl: null, updatedAt: null };
  }
  return {
    tenant: brandingSlug(slug),
    hasLogo: true,
    schoolName: info.schoolName || null,
    logoUrl: `/api/branding/logo?t=${encodeURIComponent(String(info.updatedAt || Date.now()))}`,
    updatedAt: info.updatedAt || null,
  };
}
