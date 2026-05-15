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
 * Cadence is intentionally calm (≈4 posts/day): too many notifications
 * → people mute → a muted channel benefits no one.
 */
export const schedules: ScheduleDef[] = [
  {
    name: 'morning_azkar',
    kind: 'message',
    cron: '0 6 * * *',
    content: morningAzkar,
    description: 'أذكار الصباح — كل يوم 6:00 ص (داخل وقت الذكر صباحًا).',
  },
  {
    name: 'friday_kahf',
    kind: 'message',
    cron: '0 7 * * 5',
    content: fridayKahf,
    description: 'سورة الكهف + الصلاة على النبي — الجمعة 7:00 ص.',
  },
  {
    name: 'fasting_reminder',
    kind: 'message',
    cron: '0 20 * * 0,3',
    content: fastingReminder,
    description: 'تذكير صيام الإثنين/الخميس — مساء الأحد والأربعاء 8:00 م.',
  },
  {
    name: 'evening_azkar',
    kind: 'message',
    cron: '30 16 * * *',
    content: eveningAzkar,
    description: 'أذكار المساء — كل يوم 4:30 م (بعد العصر، قبل المغرب).',
  },
  {
    name: 'night_review_poll',
    kind: 'poll',
    cron: '0 21 * * *',
    poll: nightReviewPoll,
    description: 'استبيان مراجعة الليلة (مجهول) — كل يوم 9:00 م.',
  },
  {
    name: 'pre_sleep',
    kind: 'message',
    cron: '45 21 * * *',
    content: preSleepReminder,
    description: 'سورة المُلك + أذكار النوم + نيّة القيام — كل يوم 9:45 م.',
  },
];

/** Lookup helper used by /admin_run. */
export function findSchedule(name: string): ScheduleDef | undefined {
  return schedules.find((s) => s.name === name);
}
