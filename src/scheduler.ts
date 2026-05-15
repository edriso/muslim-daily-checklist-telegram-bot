import cron, { type ScheduledTask } from 'node-cron';
import type { Bot, Context } from 'grammy';
import { schedules, type ScheduleDef } from './schedules';
import { pickContent } from './lib/pick';
import { postToChannel } from './lib/post';
import { logger } from './lib/logger';
import { config } from './config';

const tasks: ScheduledTask[] = [];

/**
 * Run one schedule definition: pick its content, post to channel, log.
 * Exported so /admin_run can fire the same code path manually.
 */
export async function runSchedule(bot: Bot<Context>, def: ScheduleDef): Promise<number | null> {
  const text = pickContent(def.content);
  if (!text) {
    logger.warn('Schedule has no content to post, skipping', { name: def.name });
    return null;
  }
  return postToChannel(bot, text, { scheduleName: def.name });
}

/**
 * Wrap a schedule callback with logging and error containment.
 * node-cron does not swallow rejected promises cleanly across versions,
 * so we catch here as belt-and-suspenders.
 */
function trackedJob(bot: Bot<Context>, def: ScheduleDef): () => Promise<void> {
  return async () => {
    logger.info('Schedule firing', { name: def.name });
    try {
      await runSchedule(bot, def);
    } catch (err) {
      logger.error('Schedule failed', { name: def.name, error: String(err) });
    }
  };
}

/**
 * Register every schedule from src/schedules.ts with node-cron. Returns
 * the count for an info log.
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
