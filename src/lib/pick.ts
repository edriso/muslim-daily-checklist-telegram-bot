/**
 * Pick the content to post for a schedule.
 *
 * Accepts either a fixed string (always returned) or an array of strings
 * (a random element is returned). For arrays we use Math.random which is
 * fine for "vary the daily message"; cryptographic randomness is not
 * needed here.
 *
 * Returns null if the input is an empty array. Callers should log and
 * skip that tick rather than posting an empty message.
 */
export function pickContent(content: string | readonly string[]): string | null {
  if (typeof content === 'string') return content.trim() ? content : null;
  if (content.length === 0) return null;
  return content[Math.floor(Math.random() * content.length)];
}
