import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  History,
  Loader2,
  Plus,
  Trash2,
  Upload,
  AlertTriangle,
  SkipForward,
} from 'lucide-react';
import {
  confirmStudentImport,
  downloadStudentImportErrors,
  downloadStudentImportTemplate,
  extractStudentsFromChitPhotos,
  getStudentImportHistory,
  validateStudentImportFile,
  validateStudentImportRows,
} from '../services/studentImportService.js';

const RESULT_TABS = [
  { id: 'successful', label: 'Successful' },
  { id: 'failed', label: 'Failed' },
  { id: 'duplicate', label: 'Duplicate / Skipped' },
];

const EMPTY_DRAFT = () => ({
  tempId: `new-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  admissionNo: '',
  rollNo: '',
  name: '',
  gender: '',
  dob: '',
  className: '',
  sectionName: '',
  parentName: '',
  parentMobile: '',
  parentEmail: '',
  address: '',
  confidence: 'manual',
});

function formatDateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function StatCard({ label, value, tone = 'default' }) {
  const tones = {
    default: 'bg-white border-gray-200 text-gray-900',
    ok: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    bad: 'bg-red-50 border-red-200 text-red-800',
    warn: 'bg-amber-50 border-amber-200 text-amber-900',
  };
  return (
    <div className={`rounded-xl border px-4 py-3 ${tones[tone] || tones.default}`}>
      <p className="text-xs font-medium uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value ?? 0}</p>
    </div>
  );
}

function RowTable({ rows, mode }) {
  if (!rows?.length) {
    return (
      <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
        No rows in this category.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
          <tr>
            <th className="px-3 py-2">Row</th>
            <th className="px-3 py-2">Class</th>
            <th className="px-3 py-2">Section</th>
            <th className="px-3 py-2">Roll</th>
            <th className="px-3 py-2">Name</th>
            <th className="px-3 py-2">Father</th>
            <th className="px-3 py-2">Mother</th>
            <th className="px-3 py-2">Email</th>
            <th className="px-3 py-2">Father's No</th>
            <th className="px-3 py-2">Mother's No</th>
            {(mode === 'failed' || mode === 'duplicate') && (
              <th className="px-3 py-2">Reason</th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {rows.map((r) => (
            <tr key={`${r.excelRow}-${r.className}-${r.sectionName}-${r.rollNo}`}>
              <td className="px-3 py-2 text-gray-500">{r.excelRow}</td>
              <td className="px-3 py-2">{r.className || '—'}</td>
              <td className="px-3 py-2">{r.sectionName || '—'}</td>
              <td className="px-3 py-2">{r.rollNo || '—'}</td>
              <td className="px-3 py-2 font-medium text-gray-900">{r.name || '—'}</td>
              <td className="px-3 py-2">{r.fatherName || r.parentName || '—'}</td>
              <td className="px-3 py-2">{r.motherName || '—'}</td>
              <td className="px-3 py-2">{r.parentEmail || '—'}</td>
              <td className="px-3 py-2">{r.fatherMobile || r.parentMobile || '—'}</td>
              <td className="px-3 py-2">{r.motherMobile || '—'}</td>
              {(mode === 'failed' || mode === 'duplicate') && (
                <td className="px-3 py-2 text-red-700">{r.errorReason || '—'}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const draftFields = [
  ['className', 'Class'],
  ['sectionName', 'Section'],
  ['rollNo', 'Roll'],
  ['name', 'Name'],
];

function DraftEditor({ drafts, onChange, onRemove, onAdd }) {
  if (!drafts?.length) {
    return (
      <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
        No extracted rows yet. Upload a clearer chit photo, or add a row manually.
        <div className="mt-3">
          <button
            type="button"
            onClick={onAdd}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <Plus size={14} />
            Add row
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              {draftFields.map(([_, label]) => (
                <th key={label} className="px-2 py-2 whitespace-nowrap">
                  {label}
                </th>
              ))}
              <th className="px-2 py-2"> </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {drafts.map((row, idx) => (
              <tr
                key={row.tempId || idx}
                className={
                  row.confidence === 'low'
                    ? 'bg-amber-50/60'
                    : row.confidence === 'high'
                      ? ''
                      : ''
                }
              >
                {draftFields.map(([key]) => (
                  <td key={key} className="px-1 py-1">
                    <input
                      value={row[key] || ''}
                      onChange={(e) => onChange(idx, key, e.target.value)}
                      className="w-full min-w-[5.5rem] rounded border border-gray-200 px-1.5 py-1 text-sm focus:border-indigo-500 focus:outline-none"
                    />
                  </td>
                ))}
                <td className="px-2 py-1">
                  <button
                    type="button"
                    onClick={() => onRemove(idx)}
                    className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                    title="Remove row"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        onClick={onAdd}
        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
      >
        <Plus size={14} />
        Add row
      </button>
    </div>
  );
}

export default function StudentBulkImportPage({ user, onBack }) {
  const [sourceMode, setSourceMode] = useState('excel'); // excel | chits
  const [file, setFile] = useState(null);
  const [chitFiles, setChitFiles] = useState([]);
  const [chitClass, setChitClass] = useState('');
  const [chitSection, setChitSection] = useState('');
  const [drafts, setDrafts] = useState([]);
  const [chitWarning, setChitWarning] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [importMeta, setImportMeta] = useState(null);
  const [summary, setSummary] = useState(null);
  const [rows, setRows] = useState(null);
  const [resultTab, setResultTab] = useState('successful');
  const [finalSummary, setFinalSummary] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyError, setHistoryError] = useState('');

  const loadHistory = useCallback(async () => {
    try {
      setHistoryError('');
      const data = await getStudentImportHistory();
      setHistory(data.history || []);
    } catch (err) {
      setHistoryError(err.message || 'Could not load import history');
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const previewCounts = useMemo(() => summary, [summary]);

  const activeRows = useMemo(() => {
    if (!rows) return [];
    if (resultTab === 'failed') return rows.failed || [];
    if (resultTab === 'duplicate') return rows.duplicate || [];
    return rows.successful || [];
  }, [rows, resultTab]);

  const applyValidationResult = async (data) => {
    setImportMeta(data.import || null);
    setSummary(data.summary || null);
    setRows(data.rows || null);
    setResultTab(
      (data.summary?.validRows || 0) > 0
        ? 'successful'
        : (data.summary?.failedRows || 0) > 0
          ? 'failed'
          : 'duplicate'
    );
    await loadHistory();
  };

  const handleDownloadTemplate = async () => {
    setError('');
    setBusy('template');
    try {
      await downloadStudentImportTemplate();
    } catch (err) {
      setError(err.message || 'Could not download template');
    } finally {
      setBusy('');
    }
  };

  const handleValidateExcel = async () => {
    setError('');
    setFinalSummary(null);
    if (!file) {
      setError('No file selected');
      return;
    }
    if (!String(file.name || '').toLowerCase().endsWith('.xlsx')) {
      setError('Only .xlsx files are accepted');
      return;
    }
    setBusy('validate');
    try {
      await applyValidationResult(await validateStudentImportFile(file));
    } catch (err) {
      setImportMeta(null);
      setSummary(null);
      setRows(null);
      setError(err.message || 'Validation failed');
    } finally {
      setBusy('');
    }
  };

  const handleExtractChits = async () => {
    setError('');
    setChitWarning('');
    setFinalSummary(null);
    setSummary(null);
    setRows(null);
    setImportMeta(null);
    if (!chitFiles.length) {
      setError('No chit photo selected');
      return;
    }
    setBusy('chits');
    try {
      const data = await extractStudentsFromChitPhotos(chitFiles, {
        className: chitClass,
        sectionName: chitSection,
      });
      setDrafts(
        (data.rows || []).map((r, i) => ({
          ...EMPTY_DRAFT(),
          ...r,
          tempId: r.tempId || `ocr-${i}`,
          className: r.className || chitClass,
          sectionName: r.sectionName || chitSection,
        }))
      );
      setChitWarning(data.warning || '');
      if (!data.rows?.length) {
        setDrafts([
          {
            ...EMPTY_DRAFT(),
            className: chitClass,
            sectionName: chitSection,
          },
        ]);
      }
    } catch (err) {
      setDrafts([]);
      setError(err.message || 'Could not read chit photos');
    } finally {
      setBusy('');
    }
  };

  const handleValidateDrafts = async () => {
    setError('');
    setFinalSummary(null);
    const cleaned = drafts
      .map((r) => ({
        admissionNo: r.admissionNo?.trim() || '',
        rollNo: r.rollNo?.toString().trim() || '',
        name: r.name?.trim() || '',
        gender: r.gender?.trim() || '',
        dob: r.dob?.trim() || '',
        className: r.className?.trim() || chitClass,
        sectionName: r.sectionName?.trim() || chitSection,
        parentName: r.parentName?.trim() || '',
        parentMobile: r.parentMobile?.trim() || '',
        parentEmail: r.parentEmail?.trim() || '',
        address: r.address?.trim() || '',
      }))
      .filter((r) => r.name || r.admissionNo || r.rollNo);
    if (!cleaned.length) {
      setError('Add at least one student row before validating');
      return;
    }
    setBusy('validate');
    try {
      await applyValidationResult(
        await validateStudentImportRows(cleaned, 'chit-extract.xlsx')
      );
    } catch (err) {
      setImportMeta(null);
      setSummary(null);
      setRows(null);
      setError(err.message || 'Validation failed');
    } finally {
      setBusy('');
    }
  };

  const handleImport = async () => {
    if (!importMeta?.id) {
      setError('Validate before importing');
      return;
    }
    if (!summary?.validRows) {
      setError('There are no valid rows to import');
      return;
    }
    setError('');
    setBusy('import');
    try {
      const data = await confirmStudentImport(importMeta.id);
      setFinalSummary(data.summary || null);
      setImportMeta(data.import || importMeta);
      await loadHistory();
    } catch (err) {
      setError(err.message || 'Import failed');
    } finally {
      setBusy('');
    }
  };

  const handleDownloadErrors = async (importId) => {
    setError('');
    setBusy(`errors-${importId}`);
    try {
      await downloadStudentImportErrors(importId);
    } catch (err) {
      setError(err.message || 'Could not download error report');
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-800"
          >
            <ArrowLeft size={16} />
            Back to Students
          </button>
          <h1 className="text-2xl font-semibold text-gray-900">Bulk Student Import</h1>
          <p className="mt-1 text-sm text-gray-500">
            Download the template, upload an Excel file, validate rows, then import valid students.
            {user?.name ? ` Signed in as ${user.name}.` : ''}
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm lg:col-span-2">
          {sourceMode === 'excel' ? (
            <>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                Excel workflow
              </h2>
              <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-gray-600">
                <li>Download the school Excel template (Class, Section, Roll, Name, then family and contact columns)</li>
                <li>Fill one row per student — or upload a school sheet with those columns</li>
                <li>Validate — review Successful / Failed / Duplicate tabs</li>
                <li>Import only valid students</li>
              </ol>

              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  disabled={!!busy}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  {busy === 'template' ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Download size={16} />
                  )}
                  Download Template
                </button>
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                  <Upload size={16} />
                  Choose File
                  <input
                    type="file"
                    accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    className="hidden"
                    onChange={(e) => {
                      setFile(e.target.files?.[0] || null);
                      setSummary(null);
                      setRows(null);
                      setImportMeta(null);
                      setFinalSummary(null);
                      setError('');
                    }}
                  />
                </label>
                <button
                  type="button"
                  onClick={handleValidateExcel}
                  disabled={!!busy || !file}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {busy === 'validate' ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <FileSpreadsheet size={16} />
                  )}
                  Validate File
                </button>
              </div>
              <p className="mt-3 text-sm text-gray-500">
                {file ? (
                  <>
                    Selected: <span className="font-medium text-gray-800">{file.name}</span>
                  </>
                ) : (
                  'No file selected yet.'
                )}
              </p>
              <p className="mt-4 text-sm text-gray-500">
                <button
                  type="button"
                  onClick={() => {
                    setSourceMode('chits');
                    setError('');
                    setSummary(null);
                    setRows(null);
                    setImportMeta(null);
                    setFinalSummary(null);
                  }}
                  className="inline-flex items-center gap-1.5 font-medium text-gray-500 underline-offset-2 hover:text-indigo-600 hover:underline"
                >
                  <Camera size={14} />
                  Advanced: import from photo
                </button>
              </p>
            </>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                  Photo / paper chit workflow
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setSourceMode('excel');
                    setError('');
                  }}
                  className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
                >
                  Back to Excel import
                </button>
              </div>
              <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-gray-600">
                <li>Set class &amp; section for this list (must already exist)</li>
                <li>Photograph the chit clearly and upload (up to 8 photos)</li>
                <li>Review / correct extracted rows (OCR is not perfect)</li>
                <li>Validate, then import valid students</li>
              </ol>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">
                    Default class
                  </label>
                  <input
                    value={chitClass}
                    onChange={(e) => setChitClass(e.target.value)}
                    placeholder="e.g. LKG or 1"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">
                    Default section
                  </label>
                  <input
                    value={chitSection}
                    onChange={(e) => setChitSection(e.target.value)}
                    placeholder="e.g. A"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                  <Camera size={16} />
                  Choose photos
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                    multiple
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      setChitFiles(Array.from(e.target.files || []));
                      setDrafts([]);
                      setChitWarning('');
                      setSummary(null);
                      setRows(null);
                      setImportMeta(null);
                      setFinalSummary(null);
                      setError('');
                    }}
                  />
                </label>
                <button
                  type="button"
                  onClick={handleExtractChits}
                  disabled={!!busy || !chitFiles.length}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {busy === 'chits' ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Camera size={16} />
                  )}
                  Extract from photos
                </button>
                <button
                  type="button"
                  onClick={handleValidateDrafts}
                  disabled={!!busy || !drafts.length}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
                >
                  {busy === 'validate' ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <FileSpreadsheet size={16} />
                  )}
                  Validate extracted rows
                </button>
              </div>

              <p className="mt-3 text-sm text-gray-500">
                {chitFiles.length
                  ? `${chitFiles.length} photo(s): ${chitFiles.map((f) => f.name).join(', ')}`
                  : 'No chit photos selected yet.'}
              </p>
              {busy === 'chits' && (
                <p className="mt-2 text-sm text-indigo-600">
                  Reading text from photos — this can take a minute…
                </p>
              )}
              {chitWarning && (
                <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  {chitWarning}
                </p>
              )}
            </>
          )}

          <div className="mt-5 flex flex-wrap gap-2 border-t border-gray-100 pt-4">
            <button
              type="button"
              onClick={handleImport}
              disabled={!!busy || !importMeta?.id || !summary?.validRows || !!finalSummary}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {busy === 'import' ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <CheckCircle2 size={16} />
              )}
              Import Students
            </button>
            {importMeta?.hasErrorReport && (
              <button
                type="button"
                onClick={() => handleDownloadErrors(importMeta.id)}
                disabled={!!busy}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-50"
              >
                {busy === `errors-${importMeta.id}` ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <AlertTriangle size={16} />
                )}
                Download Error Report
              </button>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
            <History size={16} />
            Tips
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-gray-600">
            {sourceMode === 'excel' ? (
              <>
                <li>
                  Required: <strong>Class, Section, Roll Number, Student Name</strong>. Optional columns include{' '}
                  <strong>DOB, Gender, Blood Group, Father Name, Mother Name, Email, Father phone, Mother Phone</strong>{' '}
                  and address fields. Parent logins use father/mother phone numbers.
                </li>
                <li>Headers like Roll No / Std / Sec are accepted (any order).</li>
                <li>Class and section must already exist in Presence.</li>
                <li>Duplicates (roll + class + section) are skipped.</li>
              </>
            ) : (
              <>
                <li>Use good light; keep the chit flat and fill the frame.</li>
                <li>Printed lists work better than messy handwriting.</li>
                <li>Always review OCR rows — fix names, rolls, and phones before validate.</li>
                <li>Class/section defaults apply when the photo does not mention them.</li>
              </>
            )}
          </ul>
        </section>
      </div>

      {sourceMode === 'chits' && (drafts.length > 0 || chitFiles.length > 0) && (
        <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-gray-900">Review extracted rows</h2>
            <p className="text-xs text-gray-500">Amber-tinted rows need extra checking.</p>
          </div>
          <DraftEditor
            drafts={drafts}
            onChange={(idx, key, value) => {
              setDrafts((prev) =>
                prev.map((row, i) => (i === idx ? { ...row, [key]: value } : row))
              );
            }}
            onRemove={(idx) => setDrafts((prev) => prev.filter((_, i) => i !== idx))}
            onAdd={() =>
              setDrafts((prev) => [
                ...prev,
                {
                  ...EMPTY_DRAFT(),
                  className: chitClass,
                  sectionName: chitSection,
                },
              ])
            }
          />
        </section>
      )}

      {previewCounts && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Preview results</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Total Rows" value={previewCounts.totalRows} />
            <StatCard label="Valid Rows" value={previewCounts.validRows} tone="ok" />
            <StatCard label="Failed Rows" value={previewCounts.failedRows} tone="bad" />
            <StatCard
              label="Duplicate / Skipped"
              value={previewCounts.duplicateRows}
              tone="warn"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {RESULT_TABS.map((tab) => {
              const count =
                tab.id === 'successful'
                  ? rows?.successful?.length || 0
                  : tab.id === 'failed'
                    ? rows?.failed?.length || 0
                    : rows?.duplicate?.length || 0;
              const active = resultTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setResultTab(tab.id)}
                  className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium ${
                    active
                      ? 'bg-indigo-600 text-white'
                      : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {tab.id === 'successful' && <CheckCircle2 size={14} />}
                  {tab.id === 'failed' && <AlertTriangle size={14} />}
                  {tab.id === 'duplicate' && <SkipForward size={14} />}
                  {tab.label}
                  <span
                    className={`rounded-full px-1.5 text-xs ${active ? 'bg-white/20' : 'bg-gray-100'}`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <RowTable rows={activeRows} mode={resultTab} />
        </section>
      )}

      {finalSummary && (
        <section className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-5">
          <h2 className="text-lg font-semibold text-emerald-900">Import summary</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Total Rows" value={finalSummary.totalRows} />
            <StatCard label="Imported" value={finalSummary.successfullyImported} tone="ok" />
            <StatCard label="Failed" value={finalSummary.failed} tone="bad" />
            <StatCard label="Duplicate / Skipped" value={finalSummary.duplicateSkipped} tone="warn" />
          </div>
          <dl className="mt-4 grid gap-2 text-sm text-gray-700 sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase text-gray-500">Uploaded by</dt>
              <dd className="font-medium">{finalSummary.uploadedBy || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-gray-500">File name</dt>
              <dd className="font-medium">{finalSummary.fileName || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-gray-500">Processing date/time</dt>
              <dd className="font-medium">{formatDateTime(finalSummary.processingDateTime)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-gray-500">Status</dt>
              <dd className="font-medium">{finalSummary.status || '—'}</dd>
            </div>
          </dl>
        </section>
      )}

      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-gray-900">Import history</h2>
          <button
            type="button"
            onClick={loadHistory}
            className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
          >
            Refresh
          </button>
        </div>
        {historyError && <p className="mt-2 text-sm text-red-600">{historyError}</p>}
        {!history.length ? (
          <p className="mt-4 text-sm text-gray-500">No imports yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">File</th>
                  <th className="px-3 py-2">By</th>
                  <th className="px-3 py-2">Total</th>
                  <th className="px-3 py-2">Imported</th>
                  <th className="px-3 py-2">Failed</th>
                  <th className="px-3 py-2">Duplicates</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Errors</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {history.map((h) => (
                  <tr key={h.id}>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-600">
                      {formatDateTime(h.completedAt || h.createdAt)}
                    </td>
                    <td className="px-3 py-2 font-medium text-gray-900">{h.originalFileName}</td>
                    <td className="px-3 py-2">{h.uploadedByName || h.uploadedBy}</td>
                    <td className="px-3 py-2">{h.totalRows}</td>
                    <td className="px-3 py-2 text-emerald-700">{h.successfulRows}</td>
                    <td className="px-3 py-2 text-red-700">{h.failedRows}</td>
                    <td className="px-3 py-2 text-amber-800">{h.duplicateRows}</td>
                    <td className="px-3 py-2">
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                        {h.status}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {h.hasErrorReport ? (
                        <button
                          type="button"
                          onClick={() => handleDownloadErrors(h.id)}
                          className="text-indigo-600 hover:underline"
                          disabled={!!busy}
                        >
                          Download
                        </button>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
