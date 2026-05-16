/**
 * Pick the content to post for a schedule.
 *
 * Accepts either a fixed string (always returned) or an array of strings
 * (a random element is returned). For arrays we use Math.random which is
 * fine for "vary the daily message"; cryptographic randomness is not
 * needed here.
 *
 * Blank entries (empty or whitespace-only) are never returned: a string
 * is rejected, and an array is filtered to its non-blank entries before
 * the random pick. Returns null when nothing postable remains, so the
 * caller logs and skips that tick instead of sending an empty message
 * (which Telegram would reject anyway).
 */
export function pickContent(content: string | readonly string[]): string | null {
  if (typeof content === 'string') return content.trim() ? content : null;
  const usable = content.filter((c) => c.trim().length > 0);
  if (usable.length === 0) return null;
  return usable[Math.floor(Math.random() * usable.length)];
}
