import 'dotenv/config';

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function optionalBigInt(raw: string | undefined): bigint | null {
  if (!raw) return null;
  try {
    return BigInt(raw);
  } catch {
    return null;
  }
}

/**
 * Turn a raw value into a public https://t.me/ link, or null if it has
 * no derivable public link. Accepts an "@username", a "t.me/..." URL
 * (with or without scheme), or a full "https://t.me/..." URL. A numeric
 * "-100..." id returns null: it has no public link without an API call
 * and admin rights, so callers just omit the link in that case.
 *
 * This is used for two inputs (see config below): the optional
 * CHANNEL_PUBLIC_URL, and, as a fallback, CHANNEL_CHAT_ID itself (so a
 * channel configured by "@username" still gets a link for free).
 * Exported for unit testing.
 */
export function channelUrlFrom(raw: string): string | null {
  const id = raw.trim();
  if (id.startsWith('@')) {
    const handle = id.slice(1);
    return /^[A-Za-z0-9_]{4,32}$/.test(handle) ? `https://t.me/${handle}` : null;
  }
  const m = id.match(/^https?:\/\/t\.me\/(.+)$/i) ?? id.match(/^t\.me\/(.+)$/i);
  return m ? `https://t.me/${m[1]}` : null;
}

const channelChatId = requireEnv('CHANNEL_CHAT_ID').trim();
// Optional. The channel's public link, shown only by /start. Kept
// SEPARATE from CHANNEL_CHAT_ID on purpose: posting should use the
// stable numeric id (immune to username changes), while the cosmetic
// link comes from here. Falls back to deriving from CHANNEL_CHAT_ID so
// an "@username" setup still shows a link with no extra config.
const channelPublicUrl = process.env.CHANNEL_PUBLIC_URL?.trim();

export const config = Object.freeze({
  botToken: requireEnv('BOT_TOKEN'),
  // REQUIRED. Best practice is the numeric "-100..." id (never changes,
  // even if the channel username does). "@channel" also works. Passed
  // as-is to bot.api.sendMessage. A t.me URL is NOT accepted here by
  // Telegram; use CHANNEL_PUBLIC_URL for the link instead.
  channelChatId,
  // Public link for /start, or null if none is configured/derivable.
  channelUrl: channelUrlFrom(channelPublicUrl || channelChatId),
  // Optional. If unset, /admin_* commands won't authorise anyone.
  adminTelegramId: optionalBigInt(process.env.ADMIN_TELEGRAM_ID),
  // Timezone for every cron schedule in src/schedules.ts. Defaults to UTC.
  timezone: process.env.TZ_NAME?.trim() || 'UTC',
  // Tiny JSON sidecar that remembers the last message_id we posted per
  // message-schedule, so the replace-on-next-fire delete survives a
  // restart. Not a database — a single pointer file, like .env. Losing
  // it just means each schedule leaks one stale message until the next
  // cycle. See src/lib/state.ts.
  stateFilePath: process.env.STATE_FILE?.trim() || './data/last-message-ids.json',
  isDev: process.env.NODE_ENV !== 'production',
});
