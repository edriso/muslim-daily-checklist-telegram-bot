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

export const config = Object.freeze({
  botToken: requireEnv('BOT_TOKEN'),
  // REQUIRED. Accepts "@channel" or "-100..." numeric. Passed as-is to
  // bot.api.sendMessage; Telegram accepts either form.
  channelChatId: requireEnv('CHANNEL_CHAT_ID').trim(),
  // Optional. If unset, /admin_* commands won't authorise anyone.
  adminTelegramId: optionalBigInt(process.env.ADMIN_TELEGRAM_ID),
  // Timezone for every cron schedule in src/schedules.ts. Defaults to UTC.
  timezone: process.env.TZ_NAME?.trim() || 'UTC',
  isDev: process.env.NODE_ENV !== 'production',
});
