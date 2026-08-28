import fs from 'fs/promises';
import path from 'path';
import { brandingDir, brandingSlug } from './schoolBranding.js';

const SIG_NAMES = ['signature.png', 'signature.jpg', 'signature.jpeg', 'signature.webp'];
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

export const SIG_MAX_BYTES = 1 * 1024 * 1024;
export const SIG_MIME_TYPES = Object.keys(MIME_EXT);

function mimeFromFileName(fileName) {
  const ext = String(fileName || '')
    .split('.')
    .pop()
    .toLowerCase();
  return EXT_MIME[ext] || 'image/png';
}

export async function saveTcSignature(slug, { buffer, mimeType, signerName, signerDesignation }) {
  const dir = brandingDir(slug);
  await fs.mkdir(dir, { recursive: true });

  let fileName = null;
  let resolvedMime = null;

  if (buffer?.length) {
    const ext = MIME_EXT[String(mimeType || '').toLowerCase()];
    if (!ext) throw new Error('Signature must be a PNG, JPEG, or WebP image.');
    if (buffer.length > SIG_MAX_BYTES) throw new Error('Signature image must be 1 MB or smaller.');
    await Promise.all(SIG_NAMES.map((name) => fs.unlink(path.join(dir, name)).catch(() => {})));
    fileName = `signature.${ext}`;
    resolvedMime = mimeType;
    await fs.writeFile(path.join(dir, fileName), buffer);
  } else {
    const existing = await readTcSignatureMeta(slug);
    fileName = existing?.fileName || null;
    resolvedMime = existing?.mimeType || null;
  }

  const json = {
    signerName: signerName ? String(signerName).trim().slice(0, 255) : null,
    signerDesignation: signerDesignation
      ? String(signerDesignation).trim().slice(0, 100)
      : 'Principal',
    fileName,
    mimeType: resolvedMime,
    updatedAt: Date.now(),
  };
  await fs.writeFile(path.join(dir, 'tc-signature.json'), JSON.stringify(json));
  return json;
}

export async function readTcSignatureMeta(slug) {
  const dir = brandingDir(slug);
  try {
    const raw = await fs.readFile(path.join(dir, 'tc-signature.json'), 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed) return parsed;
  } catch {
    // fall through
  }
  for (const name of SIG_NAMES) {
    try {
      const st = await fs.stat(path.join(dir, name));
      return {
        signerName: null,
        signerDesignation: 'Principal',
        fileName: name,
        mimeType: mimeFromFileName(name),
        updatedAt: st.mtimeMs,
      };
    } catch {
      // try next
    }
  }
  return null;
}

export async function readTcSignatureFile(slug) {
  const meta = await readTcSignatureMeta(slug);
  if (!meta?.fileName) return null;
  try {
    const buffer = await fs.readFile(path.join(brandingDir(slug), meta.fileName));
    return {
      buffer,
      mimeType: meta.mimeType || mimeFromFileName(meta.fileName),
      updatedAt: meta.updatedAt || Date.now(),
    };
  } catch {
    return null;
  }
}

/** Resolve school default signature as a data-URL for embedding in TC HTML. */
export async function resolveTcSignatureDataUrl(slug) {
  const file = await readTcSignatureFile(slug);
  if (!file?.buffer?.length) return null;
  const b64 = file.buffer.toString('base64');
  return `data:${file.mimeType || 'image/png'};base64,${b64}`;
}

export function tcSignaturePublicInfo(slug, meta, { hasImage } = {}) {
  const s = brandingSlug(slug);
  if (!meta && !hasImage) {
    return {
      tenant: s,
      hasSignature: false,
      signerName: null,
      signerDesignation: 'Principal',
      signatureUrl: null,
      updatedAt: null,
    };
  }
  const updatedAt = meta?.updatedAt || Date.now();
  const showImage = hasImage ?? Boolean(meta?.fileName);
  return {
    tenant: s,
    hasSignature: showImage,
    signerName: meta?.signerName || null,
    signerDesignation: meta?.signerDesignation || 'Principal',
    signatureUrl: showImage
      ? `/api/tc-requests/signature-image?t=${encodeURIComponent(String(updatedAt))}`
      : null,
    updatedAt,
  };
}

export function isValidSignatureDataUrl(value) {
  if (!value || typeof value !== 'string') return false;
  if (!/^data:image\/(png|jpeg|jpg|webp);base64,/i.test(value)) return false;
  if (value.length > 1.5 * 1024 * 1024) return false;
  return true;
}
