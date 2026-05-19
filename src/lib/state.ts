import { promises as fs } from 'fs';
import path from 'path';
import { logger } from './logger';

/**
 * Per-schedule "last message_id I posted" pointer store.
 *
 * Why this exists
 * ───────────────
 * `runSchedule` for `kind: 'message'` posts the new copy and then deletes
 * the previous one — the channel keeps exactly one live copy per schedule
 * and never accumulates dupes of repeating azkar. To delete "the previous
 * one" across a process restart we have to remember its message_id; with
 * only an in-memory map a redeploy would leak orphans.
 *
 * This file is the deliberate carve-out from the project's "no database"
 * principle. It is NOT a database: no schema, no migrations, no queries —
 * a single small JSON file holding `{ scheduleName: messageId }`. Same
 * conceptual weight as `.env`. The bot never depends on it for
 * correctness — it is a pointer, not state-as-truth. Lose the file and
 * the worst that happens is each schedule leaks one stale message until
 * the next cycle replaces it.
 *
 * Failure model (matches the rest of the project: log + continue)
 * ──────────────────────────────────────────────────────────────
 *   - File missing on boot              → start empty, log info.
 *   - File present but unparseable      → start empty, log warn.
 *   - Persist write fails               → log error, keep in-memory copy.
 *   - `initState` never called          → in-memory only; no disk.
 *
 * That last point lets unit tests use the module with no filesystem.
 */

let state: Record<string, number> = {};
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
        // Defensive: only accept positive integer message ids. A bad value
        // in the file must not poison memory.
        if (typeof v === 'number' && Number.isInteger(v) && v > 0) {
          state[k] = v;
        }
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

/** The last message_id we posted for this schedule, or undefined. */
export function getLastMessageId(name: string): number | undefined {
  return state[name];
}

/** Record the new message_id and persist (best-effort). */
export async function setLastMessageId(name: string, id: number): Promise<void> {
  state[name] = id;
  await persist();
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
