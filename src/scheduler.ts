import cron, { type ScheduledTask } from 'node-cron';
import type { Bot, Context } from 'grammy';
import { schedules } from './schedules';
import type { ScheduleDef } from './types';
import { pickContent } from './lib/pick';
import { postToChannel, sendPollToChannel, deleteChannelMessage } from './lib/post';
import { logger } from './lib/logger';
import { config } from './config';
import { getMessageIds, setMessageIds } from './lib/state';

const tasks: ScheduledTask[] = [];

/**
 * Run one schedule definition and return the resulting message_id (or
 * null if nothing was posted). Dispatches on `kind`:
 *
 *   - 'message' → pick content, post via sendMessage.
 *   - 'poll'    → send the anonymous self-review poll via sendPoll.
 *
 * Ring buffer (replace-on-next-fire generalised)
 * ──────────────────────────────────────────────
 * Each schedule has an effective `keepLast` (see types.ts):
 *
 *   message default = 1   → exactly one live copy (the old azkar rule).
 *   poll default    = 0   → never track, never delete (historic rule).
 *   N > 1           → keep the latest N (a "tonight + previous nights"
 *                     window — supported but currently unused in prod).
 *
 * After every successful post the new id is appended to that schedule's
 * tracked list, then any ids beyond `keepLast` (oldest first) are
 * deleted from Telegram. The nightly poll opts in with `keepLast: 1`,
 * which gives the same replace-on-next-fire behavior as messages:
 * tonight's poll fires, last night's gets deleted.
 *
 * Order matters: post FIRST, then trim. Never the other way around — a
 * network blip between "delete old" and "post new" would briefly leave
 * the channel empty for that schedule. Post-then-trim means the channel
 * always shows *something* for this schedule.
 *
 * Failed posts leave state untouched, so the next fire will still try to
 * clean up the same previous ids. Failed deletes still advance state
 * (we did our best; a stale orphan is benign — see
 * `deleteChannelMessage`).
 *
 * Any message NOT posted via this code path (manual welcome / pinned
 * intro, other admins) is never tracked here and therefore never
 * deleted. The state file's per-schedule keying makes this fall out for
 * free, no allowlist needed.
 *
 * Exported so `/admin_run` fires the exact same code path manually.
 */
export async function runSchedule(bot: Bot<Context>, def: ScheduleDef): Promise<number | null> {
  const keepLast = effectiveKeepLast(def);

  const newId = await sendForKind(bot, def);
  if (newId === null) {
    // Post failed. Keep tracked ids intact so the next fire can still
    // attempt the cleanup it would have done today.
    return null;
  }

  if (keepLast === 0) {
    // Not tracked — historic poll behavior, or an opt-out one-off.
    return newId;
  }

  const previous = getMessageIds(def.name);
  const next = [...previous, newId];
  const toDelete = next.length > keepLast ? next.splice(0, next.length - keepLast) : [];
  await setMessageIds(def.name, next);

  for (const oldId of toDelete) {
    if (oldId === newId) continue; // belt-and-suspenders; never delete what we just posted.
    // Best-effort. Failure is logged and swallowed — see deleteChannelMessage.
    await deleteChannelMessage(bot, oldId, { scheduleName: def.name });
  }

  return newId;
}

/**
 * Resolve `def.keepLast` against the kind-default. Negative values are
 * clamped to 0 (treated as "do not track") rather than throwing — a
 * config typo must not break the cron tick.
 */
function effectiveKeepLast(def: ScheduleDef): number {
  if (typeof def.keepLast === 'number' && Number.isInteger(def.keepLast) && def.keepLast >= 0) {
    return def.keepLast;
  }
  return def.kind === 'message' ? 1 : 0;
}

/** Dispatch on kind. Returns the new message_id or null on failure. */
async function sendForKind(bot: Bot<Context>, def: ScheduleDef): Promise<number | null> {
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
