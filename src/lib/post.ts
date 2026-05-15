import type { Bot, Context } from 'grammy';
import { config } from '../config';
import { logger } from './logger';

/**
 * Send one message to the configured channel.
 *
 * Returns the message_id on success, or null on send failure. Errors
 * are logged here (with the schedule name for context) and not re-thrown
 * so a transient Telegram glitch never crashes the cron tick.
 */
export async function postToChannel(
  bot: Bot<Context>,
  text: string,
  meta: { scheduleName?: string } = {},
): Promise<number | null> {
  try {
    const message = await bot.api.sendMessage(config.channelChatId, text, {
      parse_mode: 'Markdown',
    });
    logger.info('Posted to channel', {
      scheduleName: meta.scheduleName,
      messageId: message.message_id,
    });
    return message.message_id;
  } catch (err) {
    logger.error('Failed to post to channel', {
      scheduleName: meta.scheduleName,
      error: String(err),
    });
    return null;
  }
}
