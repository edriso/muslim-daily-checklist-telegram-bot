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

/**
 * Delete one previously-posted message from the channel.
 *
 * Used by the replace-on-next-fire flow in `runSchedule`: when a message
 * schedule fires for the Nth time, the new copy is posted first and then
 * the (N-1)th message id is deleted, so the channel keeps exactly one
 * live copy per schedule and never accumulates dupes of repeating azkar.
 *
 * Notes / why no throws
 * ─────────────────────
 * Failures here are *non-fatal by design*. The most common cause is "the
 * admin already deleted that message manually" — Telegram returns 400,
 * we log warn, and move on. A transient network error is the same: a
 * leaked old message is purely cosmetic and self-bounded.
 *
 * Admin right required
 * ────────────────────
 * In a channel the bot needs the `can_delete_messages` admin right —
 * note this is in addition to "Post messages". With it, the 48-hour
 * deleteMessage cap does not apply, so the bot can still delete a
 * weekly schedule's previous post 7 days later (e.g. Friday sunnah).
 * See CLAUDE.md and DEPLOY.md.
 *
 * Returns true on success, false on any failure (logged, not thrown).
 */
export async function deleteChannelMessage(
  bot: Bot<Context>,
  messageId: number,
  meta: { scheduleName?: string } = {},
): Promise<boolean> {
  try {
    await bot.api.deleteMessage(config.channelChatId, messageId);
    logger.info('Deleted previous channel message', {
      scheduleName: meta.scheduleName,
      messageId,
    });
    return true;
  } catch (err) {
    // warn (not error): a missing previous message is the routine case
    // when an admin tidied the channel by hand. Don't shout for it.
    logger.warn('Failed to delete previous channel message', {
      scheduleName: meta.scheduleName,
      messageId,
      error: String(err),
    });
    return false;
  }
}

/** Telegram's allowed poll auto-close window, expressed in hours. */
export const MIN_CLOSE_HOURS = 5 / 3600; // 5 seconds
export const MAX_CLOSE_HOURS = 2_628_000 / 3600; // ~30.4 days

/** Unicode bidi isolate (UAX #9): RLI … PDI. */
const RLI = '\u2067'; // RIGHT-TO-LEFT ISOLATE
const PDI = '\u2069'; // POP DIRECTIONAL ISOLATE

/**
 * Wrap one RTL line so Telegram cannot mis-order it in the poll-results
 * view, WITHOUT using parse_mode.
 *
 * Poll text here is plain (this project forbids parse_mode — Arabic
 * du'a contains `* _ ( ) <` that HTML/Markdown 400s on, see CLAUDE.md),
 * so the HTML `dir="rtl"` trick is unavailable. The standards-correct
 * plain-text equivalent is the bidi *isolate* pair: RLI pins the line's
 * base direction to right-to-left, PDI closes the isolated run. Unlike
 * a lone prepended RLM (which W3C calls a "goto-like" hack), the
 * isolate also walls the line off from the vote %/count Telegram
 * concatenates around each option — that surrounding number is exactly
 * what was rendering on top of the (leading) emoji. Content keeps the
 * emoji at the *end* of the string too (see content/poll.ts); the two
 * together are the robust fix. Telegram still has its own open RTL poll
 * bugs we can't reach, but this removes the collision we control.
 */
export function rtlIsolate(text: string): string {
  return `${RLI}${text}${PDI}`;
}

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
  // plain strings. Each option (and the question) is bidi-isolated so
  // Telegram's results view can't render the emoji on top of the vote
  // numbers — see rtlIsolate above and content/poll.ts.
  const options = spec.options.map((text) => ({ text: rtlIsolate(text) }));

  try {
    const message = await bot.api.sendPoll(
      config.channelChatId,
      rtlIsolate(spec.question),
      options,
      {
        is_anonymous: isAnonymous,
        allows_multiple_answers: allowsMultiple,
        close_date: closeDate,
      },
    );
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
