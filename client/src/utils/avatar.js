export const AVATAR_EMOJIS = ["😀", "😎", "🤓", "🦊", "🐼", "🐸", "🦁", "🐨", "🚀", "⭐", "🎯", "🔥"];

function storageKey(userId) {
  return `smartquiz_avatar_${userId}`;
}

export function getAvatar(userId) {
  if (!userId) return null;
  return localStorage.getItem(storageKey(userId));
}

export function setAvatar(userId, emoji) {
  if (!userId) return;
  localStorage.setItem(storageKey(userId), emoji);
}
