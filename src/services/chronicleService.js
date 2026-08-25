const STORAGE_KEY = 'presence.chronicle.posters.v1';

export function listSavedChronicles() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveChronicleEntry(entry) {
  const list = listSavedChronicles();
  const next = [
    {
      id: entry.id || `chr-${Date.now()}`,
      createdAt: entry.createdAt || new Date().toISOString(),
      ...entry,
    },
    ...list,
  ].slice(0, 40);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function deleteChronicleEntry(id) {
  const next = listSavedChronicles().filter((x) => x.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}
