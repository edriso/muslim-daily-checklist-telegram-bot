import { config } from './config';
import { bot, setBotCommands } from './bot';
import { startScheduler, stopScheduler } from './scheduler';
import { startHealthServer } from './health';
import { logger } from './lib/logger';
import { initState } from './lib/state';

async function main() {
  logger.info('Channel bot starting...', {
    timezone: config.timezone,
    isDev: config.isDev,
    channelChatId: config.channelChatId,
  });

  // Load the pointer file BEFORE the scheduler so the first fire of any
  // message schedule already knows which previous message_id (if any)
  // to delete after posting the new copy.
  await initState(config.stateFilePath);

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

let shuttingDown = false;

async function shutdown(signal: string) {
  if (shuttingDown) return; // a second signal must not race the first
  shuttingDown = true;
  logger.info(`${signal} received, shutting down...`);
  stopScheduler();

  // bot.stop() resolves once long polling has fully stopped. Await it so
  // an in-flight update is not cut off mid-send, but cap the wait so a
  // stuck network call cannot hang the process forever.
  try {
    await Promise.race([bot.stop(), new Promise((resolve) => setTimeout(resolve, 5_000))]);
  } catch (err) {
    logger.error('Error while stopping the bot', { error: String(err) });
  }
  process.exit(0);
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));

main().catch(async (err) => {
  logger.error('Fatal error', { error: String(err) });
  // Brief delay before exit so a misconfigured deploy does not spin a
  // tight restart loop on platforms that restart immediately on exit.
  await new Promise((r) => setTimeout(r, 30_000));
  process.exit(1);
});
