import { Bot, Context } from 'grammy';
import { config } from './config';
import { logger } from './lib/logger';
import { schedules, findSchedule } from './schedules';
import { runSchedule } from './scheduler';

const bot = new Bot<Context>(config.botToken);

/** True when the message author is the configured primary admin. */
function isAdmin(ctx: Context): boolean {
  if (config.adminTelegramId === null) return false;
  return ctx.from ? BigInt(ctx.from.id) === config.adminTelegramId : false;
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
// hitting the /health HTTP endpoint.
bot.command('admin_health', async (ctx) => {
  if (!isAdmin(ctx)) return;
  const uptime = Math.floor(process.uptime());
  const days = Math.floor(uptime / 86400);
  const hours = Math.floor((uptime % 86400) / 3600);
  const mins = Math.floor((uptime % 3600) / 60);
  const lines = [
    '*Health*',
    '=============================',
    `Uptime: ${days}d ${hours}h ${mins}m`,
    `Timezone: \`${config.timezone}\``,
    `Channel: \`${config.channelChatId}\``,
    `Schedules registered: ${schedules.length}`,
  ];
  for (const s of schedules) {
    lines.push(`  - \`${s.name}\` [${s.kind}] (\`${s.cron}\`)`);
  }
  await ctx.reply(lines.join('\n'), { parse_mode: 'Markdown' });
});

// /admin_run <name> manually fires one schedule by name. Same code path
// as the cron callback so it's a real end-to-end test.
bot.command('admin_run', async (ctx) => {
  if (!isAdmin(ctx)) return;
  const raw = ctx.message?.text ?? '';
  const name = raw.replace(/^\/admin_run(@\S+)?\s*/, '').trim();
  if (!name) {
    await ctx.reply('Usage: `/admin_run <schedule-name>`', { parse_mode: 'Markdown' });
    return;
  }
  const def = findSchedule(name);
  if (!def) {
    await ctx.reply(`Unknown schedule: \`${name}\``, { parse_mode: 'Markdown' });
    return;
  }
  const messageId = await runSchedule(bot, def);
  if (messageId === null) {
    await ctx.reply(`Schedule \`${name}\` produced nothing to post.`, { parse_mode: 'Markdown' });
  } else {
    await ctx.reply(`Posted \`${name}\` to the channel (message ${messageId}).`, {
      parse_mode: 'Markdown',
    });
  }
});

bot.catch((err) => {
  logger.error('Bot error', { error: String(err.error), update: err.ctx.update.update_id });
});

async function setBotCommands() {
  await bot.api.setMyCommands([{ command: 'start', description: 'About this bot' }]);
}

export { bot, setBotCommands };
