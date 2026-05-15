import cron, { type ScheduledTask } from 'node-cron';
import type { Bot, Context } from 'grammy';
import { schedules } from './schedules';
import type { ScheduleDef } from './types';
import { pickContent } from './lib/pick';
import { postToChannel, sendPollToChannel } from './lib/post';
import { logger } from './lib/logger';
import { config } from './config';

const tasks: ScheduledTask[] = [];

/**
 * Run one schedule definition and return the resulting message_id (or
 * null if nothing was posted). Dispatches on `kind`:
 *
 *   - 'message' → pick content (fixed or random) and post as text.
 *   - 'poll'    → send the anonymous self-review poll.
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
  return postToChannel(bot, text, { scheduleName: def.name });
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
