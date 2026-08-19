const API_BASE = import.meta.env.VITE_API_BASE || '';
const STORAGE_KEY = 'presence_homework_assignments_v1';

export function listHomeworkAssignments() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHomeworkAssignmentLocal(entry) {
  const list = listHomeworkAssignments();
  const next = [
    {
      id: `HW-${Date.now()}`,
      createdAt: new Date().toISOString(),
      ...entry,
    },
    ...list,
  ].slice(0, 200);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next[0];
}

export function clearHomeworkAssignments() {
  localStorage.removeItem(STORAGE_KEY);
}

export async function saveHomeworkAssignment(entry) {
  const title = `Homework · ${entry.subject || 'General'} — ${entry.title || 'Untitled'}`;
  const lines = [];
  if (entry.dueDate) lines.push(`Due: ${entry.dueDate}`);
  if (entry.description) lines.push(entry.description);
  const body = lines.join('\n\n') || title;

  const payload = {
    title,
    body,
    audienceType: 'CLASS',
    classSectionIds: entry.sectionId ? [entry.sectionId] : [],
    attachmentName: entry.attachmentName || null,
    attachmentUrl: entry.attachmentDataUrl || null,
  };

  const res = await fetch(`${API_BASE}/api/notices`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to save homework (${res.status})`);
  }

  const localEntry = saveHomeworkAssignmentLocal(entry);
  const data = await res.json();
  return { ...data, localEntry };
}
