import cron, { type ScheduledTask } from 'node-cron';
import type { Bot, Context } from 'grammy';
import { schedules } from './schedules';
import type { ScheduleDef } from './types';
import { pickContent } from './lib/pick';
import { postToChannel, sendPollToChannel, deleteChannelMessage } from './lib/post';
import { logger } from './lib/logger';
import { config } from './config';
import { getLastMessageId, setLastMessageId } from './lib/state';

const tasks: ScheduledTask[] = [];

/**
 * Run one schedule definition and return the resulting message_id (or
 * null if nothing was posted). Dispatches on `kind`:
 *
 *   - 'message' → pick content, post, then delete the previous copy of
 *                 this schedule (replace-on-next-fire; see below).
 *   - 'poll'    → send the anonymous self-review poll. Polls are NEVER
 *                 tracked or deleted: the poll IS the alive, variable
 *                 thing in the channel, and its own close_date already
 *                 ends voting at the right time.
 *
 * Replace-on-next-fire
 * ────────────────────
 * Azkar repeat verbatim every day; keeping a year of identical copies
 * would turn the channel into noise (and bury the poll for new joiners
 * who see the full history). So a message schedule keeps exactly one
 * live copy: post the new one, then delete the previous one.
 *
 * Order matters: post FIRST, then delete. Never the other way around —
 * a network blip between "delete old" and "post new" would leave the
 * channel temporarily empty for that schedule. Post-then-delete means
 * the channel always shows *something* for this schedule.
 *
 * Failed posts leave state untouched, so the next fire will still try
 * to clean up the same previous id. Failed deletes are logged as warn
 * and skipped — see `deleteChannelMessage` for why that is benign.
 *
 * Any message NOT posted via this code path (your manual welcome /
 * pinned intro, polls, other people's messages) is never tracked and
 * therefore never deleted. The discriminated union makes "delete only
 * the kinds we track" fall out for free, no allowlist needed.
 *
 * Exported so `/admin_run` fires the exact same code path manually.
 */
export async function runSchedule(bot: Bot<Context>, def: ScheduleDef): Promise<number | null> {
  if (def.kind === 'poll') {
    return sendPollToChannel(bot, def.poll, { scheduleName: def.name });
  }

  const text = pickContent(def.content);
  if (!text) {
    logger.warn('Schedule has no content to post, skipping', { name: def.name });
    return null;
  }

  const newId = await postToChannel(bot, text, { scheduleName: def.name });
  if (newId === null) {
    // Post failed. Keep the previous id intact so the next fire can
    // still attempt the cleanup it would have done today.
    return null;
  }

  const previousId = getLastMessageId(def.name);
  await setLastMessageId(def.name, newId);

  if (previousId !== undefined && previousId !== newId) {
    // Best-effort. Failure is logged and swallowed — see deleteChannelMessage.
    await deleteChannelMessage(bot, previousId, { scheduleName: def.name });
  }

  return newId;
}

/**
 * Wrap a schedule callback with logging and error containment. node-cron
 * does not swallow rejected promises cleanly across versions, so we
 * catch here as belt-and-suspenders.
 */
function trackedJob(bot: Bot<Context>, def: ScheduleDef): () => Promise<void> {
  return async () => {
    logger.info('Schedule firing', { name: def.name, kind: def.kind });
    try {
      await runSchedule(bot, def);
    } catch (err) {
      logger.error('Schedule failed', { name: def.name, error: String(err) });
    }
  };
}

/**
 * Register every schedule from src/schedules.ts with node-cron. An
 * invalid cron expression is logged and skipped; the others still run.
 * Returns the number successfully registered.
 */
export function startScheduler(bot: Bot<Context>): number {
  for (const def of schedules) {
    if (!cron.validate(def.cron)) {
      logger.error('Invalid cron expression, skipping schedule', {
        name: def.name,
        cron: def.cron,
      });
      continue;
    }
    const task = cron.schedule(def.cron, trackedJob(bot, def), {
      timezone: config.timezone,
    });
    tasks.push(task);
  }
  logger.info('Scheduler started', { registered: tasks.length, timezone: config.timezone });
  return tasks.length;
}

export function stopScheduler(): void {
  for (const task of tasks) task.stop();
  tasks.length = 0;
  logger.info('Scheduler stopped');
}
