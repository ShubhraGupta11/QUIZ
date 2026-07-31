// Local-storage backed mock store for faculty content management (frontend-only phase).

const KEYS = {
  semesters: "smartquiz_f_semesters",
  subjects: "smartquiz_f_subjects",
  chapters: "smartquiz_f_chapters",
  questions: "smartquiz_f_questions",
};

function read(key) {
  const raw = localStorage.getItem(key);
  return raw ? JSON.parse(raw) : [];
}

function write(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

export function listItems(type) {
  return read(KEYS[type]);
}

export function addItem(type, item) {
  const items = read(KEYS[type]);
  const next = [...items, { ...item, id: `${type}-${Date.now()}` }];
  write(KEYS[type], next);
  return next;
}

export function deleteItem(type, id) {
  const items = read(KEYS[type]).filter((i) => i.id !== id);
  write(KEYS[type], items);
  return items;
}
