/**
 * Shared types for schedules and content.
 *
 * Kept in its own file so content modules can import `PollSpec` without
 * creating an import cycle with `schedules.ts` (which imports content).
 */

/** A single anonymous poll definition (the nightly self-review). */
export interface PollSpec {
  /**
   * The poll question. Telegram allows up to 300 chars; we cap at 255
   * in tests to keep a safe margin across clients.
   */
  question: string;
  /**
   * 2..10 answer options, each 1..100 chars. Sent to Telegram as
   * InputPollOption objects (Bot API 7.3+ changed this from plain
   * strings); the conversion happens in lib/post.ts.
   */
  options: readonly string[];
  /**
   * Anonymous by default. Anonymous = nobody (not even this bot) sees
   * who voted, only the aggregate percentages. Keep this true: it is
   * the whole point (no riya, no identity, no database).
   */
  isAnonymous?: boolean;
  /** Allow ticking several deeds in one vote. Defaults to true. */
  allowsMultipleAnswers?: boolean;
  /**
   * Hours until Telegram auto-closes the poll. Telegram requires the
   * close time to be 5 seconds .. ~30 days in the future, so this must
   * be within (5/3600 .. 730) hours. Default 22h: closes well before
   * the next day's poll opens.
   */
  closeAfterHours?: number;
}

interface BaseSchedule {
  /** Unique, short id. Used in logs and `/admin_run <name>`. */
  name: string;
  /**
   * Standard 5-field cron, interpreted in TZ_NAME. Day-of-week:
   * 0 or 7 = Sunday, 1 = Monday, ... 5 = Friday, 6 = Saturday.
   */
  cron: string;
  /** Human note shown in `/admin_health`. Optional. */
  description?: string;
  /**
   * Ring-buffer size: how many of this schedule's past posts to keep
   * visible in the channel. After every fire, posts beyond this count
   * (oldest first) are deleted from Telegram.
   *
   *   - omit (undefined) ⇒
   *       • for `kind: 'message'`: defaults to 1 (replace-on-next-fire).
   *       • for `kind: 'poll'`   : defaults to 0 (never tracked, never
   *         deleted — historic behavior).
   *   - `0` ⇒ never track, never delete (one-off announcements).
   *   - `1` ⇒ always exactly one live copy.
   *   - `N > 1` ⇒ keep the latest N (e.g. `2` on the nightly poll shows
   *     tonight's + yesterday's, drops the day-before's on fire).
   */
  keepLast?: number;
}

/** Posts a text message. `content` may be a fixed string or, if an
 *  array, one entry is picked at random per fire (see lib/pick.ts). */
export interface MessageSchedule extends BaseSchedule {
  kind: 'message';
  content: string | readonly string[];
}

/** Sends one anonymous poll. */
export interface PollSchedule extends BaseSchedule {
  kind: 'poll';
  poll: PollSpec;
}

export type ScheduleDef = MessageSchedule | PollSchedule;
