import { apiFetch } from './api.js';

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

  const data = await apiFetch('/api/notices', {
    method: 'POST',
    json: payload,
  });

  const localEntry = saveHomeworkAssignmentLocal(entry);
  return { ...data, localEntry };
}
