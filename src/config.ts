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
 * A public https://t.me/ link for the channel, or null if none can be
 * derived from CHANNEL_CHAT_ID. Only "@username" channels (or an
 * explicit t.me URL) have a stable public link; a numeric "-100..." id
 * has no link without an API call + admin rights, so callers just omit
 * the link in that case. Exported for unit testing.
 */
export function channelUrlFrom(rawChatId: string): string | null {
  const id = rawChatId.trim();
  if (id.startsWith('@')) {
    const handle = id.slice(1);
    return /^[A-Za-z0-9_]{4,32}$/.test(handle) ? `https://t.me/${handle}` : null;
  }
  const m = id.match(/^https?:\/\/t\.me\/(.+)$/i) ?? id.match(/^t\.me\/(.+)$/i);
  return m ? `https://t.me/${m[1]}` : null;
}

const channelChatId = requireEnv('CHANNEL_CHAT_ID').trim();

export const config = Object.freeze({
  botToken: requireEnv('BOT_TOKEN'),
  // REQUIRED. Accepts "@channel" or "-100..." numeric. Passed as-is to
  // bot.api.sendMessage; Telegram accepts either form.
  channelChatId,
  // Derived public link for the channel, or null for numeric-id-only
  // channels. Used by /start to point DMs at the channel.
  channelUrl: channelUrlFrom(channelChatId),
  // Optional. If unset, /admin_* commands won't authorise anyone.
  adminTelegramId: optionalBigInt(process.env.ADMIN_TELEGRAM_ID),
  // Timezone for every cron schedule in src/schedules.ts. Defaults to UTC.
  timezone: process.env.TZ_NAME?.trim() || 'UTC',
  isDev: process.env.NODE_ENV !== 'production',
});
