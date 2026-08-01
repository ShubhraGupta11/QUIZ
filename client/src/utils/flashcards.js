function storageKey(userId) {
  return `smartquiz_flashcards_${userId}`;
}

export function getFlashcards(userId) {
  if (!userId) return [];
  try {
    const raw = localStorage.getItem(storageKey(userId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addFlashcards(userId, cards) {
  if (!userId || !cards?.length) return;
  const existing = getFlashcards(userId);
  const existingQuestions = new Set(existing.map((c) => c.questionText));
  const merged = existing.concat(cards.filter((c) => !existingQuestions.has(c.questionText)));
  localStorage.setItem(storageKey(userId), JSON.stringify(merged));
}

export function removeFlashcard(userId, id) {
  const existing = getFlashcards(userId);
  localStorage.setItem(storageKey(userId), JSON.stringify(existing.filter((c) => c.id !== id)));
}
