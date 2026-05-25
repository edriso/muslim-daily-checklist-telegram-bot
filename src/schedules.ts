import { morningAzkar } from './content/morningAzkar';
import { eveningAzkar } from './content/eveningAzkar';
import { preSleepReminder } from './content/preSleep';
import { fridaySunnah } from './content/fridaySunnah';
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
 *   • Friday morning  → morning azkar + Friday sunan (one morning ping)
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
    // 05:30 Cairo. Picked so the reminder lands INSIDE the preferred
    // Fajr→sunrise window in every season — Cairo sunrise swings from
    // ~5:55 (June, DST) to ~6:45 (December), and 05:30 sits inside
    // both. 06:00 (the old time) drifts ~5 min past sunrise in summer.
    cron: '30 5 * * *',
    content: morningAzkar,
    description: 'أذكار الصباح، كل يوم 5:30 ص (داخل وقت الذكر بين الفجر وطلوع الشمس طوال السنة).',
  },
  {
    name: 'friday_sunnah',
    kind: 'message',
    // 05:32 Cairo. Co-scheduled 2 min after morning_azkar (single
    // morning ping). Kahf's recommended window is Maghrib-Thu through
    // Maghrib-Fri, so exact morning time is forgiving; what matters
    // is the bundle with the morning azkar arrival.
    cron: '32 5 * * 5',
    content: fridaySunnah,
    description:
      'سننُ الجمعة (الطهارة والزينة، التبكير، الكهف، الصلاة على النبي)، الجمعة 5:32 ص (مع أذكار الصباح).',
  },
  {
    name: 'evening_azkar',
    kind: 'message',
    // 17:00 Cairo. الأفضل (الأصيل) أن تُقرأ بين العصر والمغرب، وعند
    // ابن باز وابن عثيمين الأمر واسع ويصحّ ما بعد المغرب أيضًا. الوقت
    // الثابت 17:00 يبقى داخل النافذة الشرعية المعتبَرة طوال السنة في
    // القاهرة: مارس–أكتوبر يقع داخل (العصر→المغرب)، ونوفمبر–فبراير
    // يقع بعد المغرب بقليل (الأمر واسع). لا انقسام موسمي ولا تتبّع
    // للتوقيت الصيفي. النصّ نفسه يبيّن للقارئ قراءتها في نافذة بلده،
    // فالبوت تذكيرٌ لا أذان. لا تُرجِعها إلى 16:30: ذاك يقع قبل العصر
    // في الصيف (العصر بالقاهرة يبلغ ~17:00 في الانقلاب الصيفي).
    cron: '0 17 * * *',
    content: eveningAzkar,
    description: 'أذكار المساء، كل يوم 5:00 م. الأفضل قراءتها بين العصر والمغرب.',
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
    // Replace-on-next-fire (same rule as messages): when tonight's poll
    // fires, last night's is deleted. Polls default to 0 (untracked), so
    // this single line is what opts the poll into cleanup. The channel
    // therefore shows exactly one live poll — no stack of identical
    // questions burying the welcome / pinned intro for new joiners.
    keepLast: 1,
    description:
      'استبيان مراجعة الليلة (مجهول)، كل يوم 9:43 م. تُحذَف نسخة الليلة السابقة عند نشر الجديدة.',
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
