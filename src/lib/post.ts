import type { Bot, Context } from 'grammy';
import { config } from '../config';
import { logger } from './logger';
import type { PollSpec } from '../types';

/**
 * Send one plain-text message to the configured channel.
 *
 * No `parse_mode` is used on purpose. The content is Arabic du'a / Quran
 * references that frequently contain characters Markdown/HTML would
 * choke on (`*`, `_`, `(`, `)`, `<`, ...). Plain text renders Arabic +
 * emoji perfectly and removes an entire class of "Telegram 400" bugs.
 * This is a deliberate simplicity-over-formatting trade. See CLAUDE.md.
 *
 * Returns the message_id on success, or null on failure (logged, not
 * thrown, so a transient Telegram glitch never crashes the cron tick).
 */
export async function postToChannel(
  bot: Bot<Context>,
  text: string,
  meta: { scheduleName?: string } = {},
): Promise<number | null> {
  try {
    const message = await bot.api.sendMessage(config.channelChatId, text);
    logger.info('Posted message to channel', {
      scheduleName: meta.scheduleName,
      messageId: message.message_id,
    });
    return message.message_id;
  } catch (err) {
    logger.error('Failed to post message to channel', {
      scheduleName: meta.scheduleName,
      error: String(err),
    });
    return null;
  }
}

/** Telegram's allowed poll auto-close window, expressed in hours. */
export const MIN_CLOSE_HOURS = 5 / 3600; // 5 seconds
export const MAX_CLOSE_HOURS = 2_628_000 / 3600; // ~30.4 days

/**
 * Send one anonymous poll to the channel (the nightly self-review).
 *
 * Anonymous + multiple-answers by default: members tick every deed they
 * did, Telegram shows the aggregate percentages to everyone, and nobody
 * — including this bot — learns who voted. No database, no riya.
 *
 * `close_date` is derived from `closeAfterHours` and clamped into
 * Telegram's accepted range, so a bad config can never make the API
 * reject the poll.
 *
 * Returns the poll message_id, or null on failure (logged, not thrown).
 */
export async function sendPollToChannel(
  bot: Bot<Context>,
  spec: PollSpec,
  meta: { scheduleName?: string } = {},
): Promise<number | null> {
  const isAnonymous = spec.isAnonymous ?? true;
  const allowsMultiple = spec.allowsMultipleAnswers ?? true;

  const requestedHours = spec.closeAfterHours ?? 22;
  const clampedHours = Math.min(Math.max(requestedHours, MIN_CLOSE_HOURS), MAX_CLOSE_HOURS);
  const closeDate = Math.floor(Date.now() / 1000) + Math.round(clampedHours * 3600);

  // Bot API 7.3+ expects an array of InputPollOption objects, not
  // plain strings.
  const options = spec.options.map((text) => ({ text }));

  try {
    const message = await bot.api.sendPoll(config.channelChatId, spec.question, options, {
      is_anonymous: isAnonymous,
      allows_multiple_answers: allowsMultiple,
      close_date: closeDate,
    });
    logger.info('Posted poll to channel', {
      scheduleName: meta.scheduleName,
      messageId: message.message_id,
      options: spec.options.length,
      isAnonymous,
      closeInHours: clampedHours,
    });
    return message.message_id;
  } catch (err) {
    logger.error('Failed to post poll to channel', {
      scheduleName: meta.scheduleName,
      error: String(err),
    });
    return null;
  }
}
