import JSZip from 'jszip';
import ExcelJS from 'exceljs';

const MAIN_NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';

function normalizeOoxml(xml) {
  if (!xml.includes('xmlns:x=')) return xml;
  let out = xml.replace(/<(\/?)x:([A-Za-z0-9]+)/g, '<$1$2').replace(/\sxmlns:x="[^"]+"/g, '');
  if (!out.includes(`xmlns="${MAIN_NS}"`)) {
    out = out.replace(/(<\?xml[^>]*\?>\s*)?<([A-Za-z0-9]+)/, `$1<$2 xmlns="${MAIN_NS}"`);
  }
  return out;
}

/** Some exporters write OOXML with an x: prefix; ExcelJS cannot read those files. */
export async function normalizeXlsxBuffer(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const targets = Object.keys(zip.files).filter((name) => /\.xml$/i.test(name) && !zip.files[name]?.dir);
  let changed = false;
  for (const name of targets) {
    const entry = zip.files[name];
    const xml = await entry.async('string');
    const next = normalizeOoxml(xml);
    if (next !== xml) {
      zip.file(name, next);
      changed = true;
    }
  }
  if (!changed) return buffer;
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

export async function loadWorkbookFromBuffer(buffer) {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer);
    return workbook;
  } catch (firstErr) {
    try {
      const normalized = await normalizeXlsxBuffer(buffer);
      if (normalized === buffer) throw firstErr;
      await workbook.xlsx.load(normalized);
      return workbook;
    } catch {
      throw firstErr;
    }
  }
}
