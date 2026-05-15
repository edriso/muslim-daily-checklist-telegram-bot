import { config } from './config';
import { bot, setBotCommands } from './bot';
import { startScheduler, stopScheduler } from './scheduler';
import { startHealthServer } from './health';
import { logger } from './lib/logger';

async function main() {
  logger.info('Channel bot starting...', {
    timezone: config.timezone,
    isDev: config.isDev,
    channelChatId: config.channelChatId,
  });

  await setBotCommands();
  startScheduler(bot);
  startHealthServer();

  // No allowed_updates customisation needed: the bot only listens for
  // messages (commands) and posts to a channel. Defaults are fine.
  bot.start({
    onStart: () => {
      logger.info('Bot is running. Press Ctrl+C to stop.');
    },
  });
}

function shutdown(signal: string) {
  logger.info(`${signal} received, shutting down...`);
  stopScheduler();
  bot.stop();
  process.exit(0);
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));

main().catch(async (err) => {
  logger.error('Fatal error', { error: String(err) });
  // Brief delay before exit so a misconfigured deploy does not spin a
  // tight restart loop on platforms that restart immediately on exit.
  await new Promise((r) => setTimeout(r, 30_000));
  process.exit(1);
});
