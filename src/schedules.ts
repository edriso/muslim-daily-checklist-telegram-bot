import { morningGreetings } from './content/morning';
import { eveningGreetings } from './content/evening';
import { tips } from './content/tips';

/**
 * One scheduled posting rule.
 *
 * `cron` uses the standard 5-field expression interpreted in the
 * timezone from `TZ_NAME` in .env. Common examples:
 *   '0 8 * * *'       every day at 08:00
 *   '0 19 * * *'      every day at 19:00
 *   '30 14 * * *'     every day at 14:30
 *   '0 9 * * 1'       every Monday at 09:00
 *
 * `content` is either:
 *   * a single string (always posted), or
 *   * an array of strings (one is picked at random per tick).
 *
 * `name` is used in logs and in /admin_run <name>. Keep it short and
 * unique. snake_case or kebab-case both work.
 */
export interface ScheduleDef {
  name: string;
  cron: string;
  content: string | readonly string[];
  description?: string;
}

/**
 * The list of schedules. Add, remove, or edit entries to change what
 * the bot posts and when. Entries that share a `cron` time run in
 * parallel, so don't double-book the same minute unless you mean to.
 */
export const schedules: ScheduleDef[] = [
  {
    name: 'morning',
    cron: '0 8 * * *',
    content: morningGreetings,
    description: 'Pick one of several morning greetings every day at 08:00.',
  },
  {
    name: 'evening',
    cron: '0 19 * * *',
    content: eveningGreetings,
    description: 'Pick one of several evening greetings every day at 19:00.',
  },
  {
    name: 'tip',
    cron: '30 14 * * *',
    content: tips,
    description: 'Pick one random tip every day at 14:30.',
  },
];

/** Lookup helper used by /admin_run. */
export function findSchedule(name: string): ScheduleDef | undefined {
  return schedules.find((s) => s.name === name);
}
