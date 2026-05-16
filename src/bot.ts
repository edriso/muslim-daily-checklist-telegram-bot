import { Bot, Context } from 'grammy';
import { config } from './config';
import { logger } from './lib/logger';
import { schedules, findSchedule } from './schedules';
import { runSchedule } from './scheduler';

const bot = new Bot<Context>(config.botToken);

/**
 * Gate for the /admin_* commands. True only for a *private* message
 * (DM) from the configured primary admin. The private-chat check
 * matters: without it the commands would also fire in any group the
 * bot is in and leak the channel id / schedule internals there. If no
 * admin id is configured, every admin command is a silent no-op.
 */
function isAdmin(ctx: Context): boolean {
  if (config.adminTelegramId === null) return false;
  if (ctx.chat?.type !== 'private') return false;
  return ctx.from ? BigInt(ctx.from.id) === config.adminTelegramId : false;
}

/** Plain-text list of every schedule name, for the /admin_run hints. */
function scheduleNameList(): string {
  return schedules.map((s) => `  - ${s.name}`).join('\n');
}

// /start in DM. The bot is channel-first; this just explains it to anyone
// who DMs the bot looking for commands.
bot.command('start', async (ctx) => {
  if (ctx.chat?.type !== 'private') return;
  const link = config.channelUrl;
  await ctx.reply(
    'السلام عليكم 🌿\n' +
      'هذا بوت تذكيرٍ يومي ينشر في قناته المحدّدة فقط (أذكار ومراجعة الليلة).\n' +
      'لا يوجد ما تتفاعل معه هنا، تابِع القناة لتصلك التذكيرات بإذن الله.' +
      (link ? `\n📢 القناة: ${link}` : '') +
      '\n\n' +
      'This bot only posts on a schedule to its channel. Nothing to do here.' +
      (link ? `\nChannel: ${link}` : ''),
  );
});

// Health check command. Useful for "is the process up?" probes without
// hitting the /health HTTP endpoint. Plain text on purpose (same reason
// the channel posts avoid parse_mode): a value that breaks Markdown
// would 400 the reply itself and the admin would see nothing.
bot.command('admin_health', async (ctx) => {
  if (!isAdmin(ctx)) return;
  const uptime = Math.floor(process.uptime());
  const days = Math.floor(uptime / 86400);
  const hours = Math.floor((uptime % 86400) / 3600);
  const mins = Math.floor((uptime % 3600) / 60);

  let now: string;
  try {
    now = new Intl.DateTimeFormat('en-CA', {
      timeZone: config.timezone,
      dateStyle: 'short',
      timeStyle: 'short',
      hour12: false,
    }).format(new Date());
  } catch {
    now = `${new Date().toISOString()} (UTC; TZ_NAME invalid)`;
  }

  const lines = [
    'Health',
    '------',
    `Uptime: ${days}d ${hours}h ${mins}m`,
    `Now: ${now} (${config.timezone})`,
    `Channel: ${config.channelChatId}${config.channelUrl ? ` (${config.channelUrl})` : ''}`,
    `Schedules registered: ${schedules.length}`,
  ];
  for (const s of schedules) {
    lines.push(`  - ${s.name} [${s.kind}] (${s.cron})`);
  }
  await ctx.reply(lines.join('\n'));
});

// /admin_run <name> manually fires one schedule by name. Same code path
// as the cron callback, so it is a real end-to-end test. The feedback
// must be honest: post.ts catches send failures and returns null, so a
// null result means "nothing posted" for one of two reasons (empty
// content OR a failed Telegram send) — say so, and point at the most
// common cause instead of the misleading "produced nothing".
bot.command('admin_run', async (ctx) => {
  if (!isAdmin(ctx)) return;
  const raw = ctx.message?.text ?? '';
  const name = raw.replace(/^\/admin_run(@\S+)?\s*/, '').trim();
  if (!name) {
    await ctx.reply(`Usage: /admin_run <schedule-name>\n\nSchedules:\n${scheduleNameList()}`);
    return;
  }
  const def = findSchedule(name);
  if (!def) {
    await ctx.reply(`Unknown schedule: ${name}\n\nSchedules:\n${scheduleNameList()}`);
    return;
  }
  try {
    const messageId = await runSchedule(bot, def);
    if (messageId === null) {
      await ctx.reply(
        `"${name}" did not post.\n` +
          'Either its content was empty, or the Telegram send failed — ' +
          'most often the bot is not a channel admin with the "Post ' +
          'messages" permission. Check the process logs for the exact error.',
      );
    } else {
      await ctx.reply(`Posted "${name}" to the channel (message ${messageId}).`);
    }
  } catch (err) {
    logger.error('admin_run threw', { name, error: String(err) });
    await ctx.reply(`"${name}" threw an unexpected error: ${String(err)}`);
  }
});

bot.catch((err) => {
  logger.error('Bot error', { error: String(err.error), update: err.ctx.update.update_id });
});

async function setBotCommands() {
  await bot.api.setMyCommands([{ command: 'start', description: 'About this bot' }]);
}

export { bot, setBotCommands };
