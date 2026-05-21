import { promises as fs } from 'fs';
import path from 'path';
import { logger } from './logger';

/**
 * Per-schedule "message_ids I posted (oldest → newest)" pointer store.
 *
 * Why this exists
 * ───────────────
 * `runSchedule` keeps each tracked schedule's last `keepLast` posts live
 * in the channel — after a fire, anything older than the cap (oldest
 * first) is deleted from Telegram. Across a process restart we must
 * remember those message_ids; an in-memory-only map would leak orphans
 * on every redeploy.
 *
 * This file is the deliberate carve-out from the project's "no database"
 * principle. It is NOT a database: no schema, no migrations, no queries —
 * a single small JSON file mapping `name → number[]` (the tracked
 * message_ids, oldest first). Same conceptual weight as `.env`. The bot
 * never depends on it for correctness — it is a pointer, not
 * state-as-truth. Lose the file and the worst that happens is each
 * schedule leaks a handful of stale messages until they age out of the
 * ring buffer.
 *
 * File-shape compatibility
 * ────────────────────────
 * Earlier versions stored `{ name: number }` (a single id). The reader
 * accepts BOTH shapes: a bare number is coerced into a length-1 array.
 * That keeps redeploys safe — no migration script, no flag day.
 *
 * Failure model (matches the rest of the project: log + continue)
 * ──────────────────────────────────────────────────────────────
 *   - File missing on boot              → start empty, log info.
 *   - File present but unparseable      → start empty, log warn.
 *   - A single entry is malformed       → drop just that entry.
 *   - Persist write fails               → log error, keep in-memory copy.
 *   - `initState` never called          → in-memory only; no disk.
 *
 * That last point lets unit tests use the module with no filesystem.
 */

let state: Record<string, number[]> = {};
let filePath: string | null = null;

/**
 * Initialise the store from disk. Call once at process start, before the
 * scheduler. Safe to call again (overwrites the path, reloads state).
 *
 * Never throws. A missing or unreadable file just means "start empty" —
 * the bot must keep posting even if the pointer file is gone.
 */
export async function initState(p: string): Promise<void> {
  filePath = p;
  state = {};
  try {
    const raw = await fs.readFile(p, 'utf8');
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
        const ids = coerceToIdArray(v);
        if (ids.length > 0) state[k] = ids;
      }
    }
    logger.info('Loaded message-id state', {
      path: p,
      tracked: Object.keys(state).length,
    });
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      logger.info('No state file yet, starting empty', { path: p });
    } else {
      logger.warn('Could not read state file, starting empty', {
        path: p,
        error: String(err),
      });
    }
  }
}

/**
 * Defensive coercion: accept both the legacy `number` shape and the
 * current `number[]` shape, and drop anything that is not a positive
 * integer (0, negatives, floats, strings, null). A bad value in the file
 * must not poison memory or be sent to Telegram as a delete id.
 */
function coerceToIdArray(v: unknown): number[] {
  if (typeof v === 'number') {
    return isValidId(v) ? [v] : [];
  }
  if (Array.isArray(v)) {
    return v.filter(isValidId);
  }
  return [];
}

function isValidId(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n > 0;
}

/** The tracked message_ids for this schedule (oldest first), or `[]`. */
export function getMessageIds(name: string): number[] {
  return state[name] ? [...state[name]] : [];
}

/** Replace the tracked ids and persist (best-effort). Empty array clears. */
export async function setMessageIds(name: string, ids: number[]): Promise<void> {
  if (ids.length === 0) {
    delete state[name];
  } else {
    state[name] = [...ids];
  }
  await persist();
}

/**
 * Compatibility shim: the most recent (newest) tracked id for this
 * schedule, or undefined. Pre-ring-buffer call sites use this.
 */
export function getLastMessageId(name: string): number | undefined {
  const arr = state[name];
  return arr && arr.length > 0 ? arr[arr.length - 1] : undefined;
}

/**
 * Compatibility shim: replace the tracked ids with a single id. Equivalent
 * to `setMessageIds(name, [id])`. Used by tests that pre-date the ring
 * buffer; production code should prefer `setMessageIds`.
 */
export async function setLastMessageId(name: string, id: number): Promise<void> {
  await setMessageIds(name, [id]);
}

/**
 * Atomic write: serialise to a `.tmp` sibling then rename. Rename is
 * atomic on the same filesystem, so a crash mid-write never leaves a
 * half-written JSON the next boot would refuse to parse.
 *
 * Persistence is best-effort: a write failure (read-only disk, full
 * volume) is logged at error level but does not throw. The in-memory
 * copy stays correct for the lifetime of the process; only the
 * cross-restart guarantee degrades.
 */
async function persist(): Promise<void> {
  if (!filePath) return; // initState was never called (e.g. tests).
  const target = filePath;
  try {
    await fs.mkdir(path.dirname(target), { recursive: true });
    const tmp = `${target}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(state, null, 2), 'utf8');
    await fs.rename(tmp, target);
  } catch (err) {
    logger.error('Failed to persist state file', {
      path: target,
      error: String(err),
    });
  }
}

/**
 * Reset module state. Tests only — production code must not call this.
 * Kept underscore-prefixed to signal "private, do not depend on this".
 */
export function _resetForTests(): void {
  state = {};
  filePath = null;
}
