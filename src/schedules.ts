import { morningAzkar } from './content/morningAzkar';
import { eveningAzkar } from './content/eveningAzkar';
import { preSleepReminder } from './content/preSleep';
import { fridayKahf } from './content/fridayKahf';
import { fastingReminder } from './content/fasting';
import { nightReviewPoll } from './content/poll';
import type { ScheduleDef } from './types';

export type { ScheduleDef } from './types';

/**
 * ───────────────────────── THE FILE TO EDIT ─────────────────────────
 *
 * Every entry is one cron rule plus what to post. Two kinds:
 *
 *   kind: 'message'  → posts text (a fixed string, or random from array)
 *   kind: 'poll'     → sends the anonymous self-review poll
 *
 * `cron` is a standard 5-field expression interpreted in TZ_NAME (.env,
 * default Africa/Cairo). Day-of-week: 0/7 = Sunday, 1 = Monday, ...,
 * 5 = Friday, 6 = Saturday.
 *
 * Times are all ≥ 02:00 on purpose: Africa/Cairo springs the clock from
 * 00:00 → 01:00 on the last Friday of April, and node-cron silently
 * drops jobs scheduled inside that missing hour. Keep new schedules at
 * 02:00 or later if TZ_NAME observes DST. See CLAUDE.md.
 *
 * Cadence is intentionally calm. What hurts retention is not the
 * message count but the number of *separate* notification moments: too
 * many → people mute → a muted channel benefits no one. So related
 * posts are CO-SCHEDULED into one tight window (offset by a minute so
 * the arrival order is deterministic) and read as a single "session":
 *
 *   • Friday morning  → morning azkar + Kahf      (one morning ping)
 *   • Every night      → poll + pre-sleep          (one bedtime ping)
 *   • Sun/Wed night    → + fasting reminder        (folded into the
 *                                                   same bedtime ping)
 *
 * That is ≤3 interruption moments/day (morning, late afternoon, night)
 * instead of 4–5 scattered ones, with no merged content and no
 * branching logic — a Telegram poll cannot live inside a text message,
 * and conditional content would break the static-content design.
 *
 * Within the bedtime window the spiritual act comes LAST: fasting
 * reminder → poll → pre-sleep, so the final thing before sleep is the
 * azkar (Mulk, sleep adhkar, qiyam niyyah), not a UI poll.
 */
export const schedules: ScheduleDef[] = [
  {
    name: 'morning_azkar',
    kind: 'message',
    cron: '0 6 * * *',
    content: morningAzkar,
    description: 'أذكار الصباح، كل يوم 6:00 ص (داخل وقت الذكر صباحًا).',
  },
  {
    name: 'friday_kahf',
    kind: 'message',
    cron: '2 6 * * 5',
    content: fridayKahf,
    description: 'سورة الكهف والصلاة على النبي، الجمعة 6:02 ص (مع أذكار الصباح).',
  },
  {
    name: 'evening_azkar',
    kind: 'message',
    cron: '30 16 * * *',
    content: eveningAzkar,
    description: 'أذكار المساء، كل يوم 4:30 م (بعد العصر، قبل المغرب).',
  },
  {
    name: 'fasting_reminder',
    kind: 'message',
    cron: '40 21 * * 0,3',
    content: fastingReminder,
    description: 'تذكير صيام الإثنين/الخميس، مساء الأحد والأربعاء 9:40 م (مع مجموعة ما قبل النوم).',
  },
  {
    name: 'night_review_poll',
    kind: 'poll',
    cron: '43 21 * * *',
    poll: nightReviewPoll,
    description: 'استبيان مراجعة الليلة (مجهول)، كل يوم 9:43 م (قبل تذكير ما قبل النوم).',
  },
  {
    name: 'pre_sleep',
    kind: 'message',
    cron: '45 21 * * *',
    content: preSleepReminder,
    description: 'سورة المُلك وأذكار النوم ونيّة القيام، كل يوم 9:45 م (آخر رسالة قبل النوم).',
  },
];

/** Lookup helper used by /admin_run. */
export function findSchedule(name: string): ScheduleDef | undefined {
  return schedules.find((s) => s.name === name);
}
