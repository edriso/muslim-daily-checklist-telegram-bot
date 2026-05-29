/**
 * Pick a string to post: a fixed string as-is, or a random entry from an
 * array. Blank entries are skipped; returns null when nothing postable
 * remains, so the caller skips the tick instead of sending an empty
 * message Telegram would reject anyway.
 */
export function pickContent(content: string | readonly string[]): string | null {
  if (typeof content === 'string') return content.trim() ? content : null;
  const usable = content.filter((c) => c.trim().length > 0);
  if (usable.length === 0) return null;
  return usable[Math.floor(Math.random() * usable.length)];
}
