import type { PollSpec } from '../types';
import { config } from '../config';
import { noFastReason } from '../lib/hijri';

/**
 * The nightly self-review poll: anonymous + multiple-answer, so nobody
 * (not even the bot) sees who voted — only aggregate percentages. No DB,
 * no riya.
 *
 * Built per fire by buildNightReviewPoll: a single BASE_OPTIONS list with
 * the day's extras spliced in from OPTIONS_BY_DAY (keyed by weekday in
 * TZ_NAME). Adding a day-specific list later (e.g. Friday) is one entry
 * in that table — no branching in the function, and one schedule + one
 * state key keeps replace-on-next-fire intact.
 *
 * Telegram limits: question ≤300 chars, 2..10 options, each ≤100. Keep
 * the emoji at the END of each string (a leading emoji collides with the
 * vote %/count Telegram appends) and leave a little margin — rtlIsolate
 * in lib/post.ts adds 2 chars.
 *
 * Wording principle: every option is an HONEST effort you can tick
 * without lying or feeling defeated («ولو ركعتين», «أدومها وإن قلّ») —
 * not a claim of perfection. Items that are genuinely done in one sitting
 * are merged; قيام الليل is kept separate from الضحى (distinct worship).
 */

const QUESTION =
  'حاسِب نفسك قبل النوم: بمَ وفّقك الله اليوم؟ (سرّي مجهول؛ أشِّر بصدقٍ على ما أدّيت، وانوِ بمشاركتك تشجيعَ غيرك والتنافسَ في الخير) 📋';

// The general list shown every night, in this deliberate order (see
// header). Single source of truth: day-specific nights inject extras
// into it via OPTIONS_BY_DAY rather than redefining the list.
const BASE_OPTIONS: readonly string[] = [
  'أذكار الاستيقاظ ثم صلاة الفجر في وقتها ⏰',
  'أذكار الصباح والمساء 🛡️',
  'ورد القرآن (ولو صفحة) 🔖',
  'صلاة الضحى ولو ركعتين ☀️',
  'حفظت لساني عن الغِيبة، ولم يَغلِبني الغضب (طوّلت بالي ولِنتُ لمن حولي) 🤍',
  'اجتهدت في خشوع صلاتي وطمأنينتها، وقُلت أذكار ما بعد الصلاة المفروضة 🕌',
  'استغفار ١٠٠ مرّة 📿',
  'قيام الليل ولو ركعتين ✨',
  'سورة المُلك وأذكار النوم 🌙',
];

/** An extra option spliced into the base list on a given night. */
interface DayOption {
  /** Option text (emoji at the END; stay under 100 chars). */
  option: string;
  /**
   * Insert right AFTER the base option equal to this text, so the extra
   * lands at its intended spot in the order. Omit to append. An unknown
   * anchor throws — a typo fails the tests instead of shipping a
   * misordered poll.
   */
  after?: string;
  /**
   * Mark a "did you fast?" option. These are removed on days nafl fasting
   * is forbidden (Eid / أيام التشريق) — there was no fast to tick. Set it
   * on any future fasting extra; non-fasting day options stay untouched.
   */
  fasting?: boolean;
}

// Insert fasting after خشوع الصلاة (last of the day's worship), before
// the pre-sleep cluster.
const FASTING_ANCHOR = 'اجتهدت في خشوع صلاتي وطمأنينتها، وقُلت أذكار ما بعد الصلاة المفروضة 🕌';

// Weekday in TZ_NAME (0=Sun..6=Sat) → options to add that night. THE
// EDIT POINT for day variants: add a key (e.g. 5 for a Friday list) here;
// buildNightReviewPoll needs no change.
const OPTIONS_BY_DAY: Record<number, readonly DayOption[]> = {
  1: [{ option: 'صيام الاثنين 🌒', after: FASTING_ANCHOR, fasting: true }], // Monday
  4: [{ option: 'صيام الخميس 🌒', after: FASTING_ANCHOR, fasting: true }], // Thursday
};

/** Weekday in `tz` (0=Sun..6=Sat) via Intl, not Date.getDay(), so
 *  "Monday" means Monday in TZ_NAME and not on the host (usually UTC). */
function weekdayInTz(now: Date, tz: string): number {
  const wd = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' }).format(now);
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[wd] ?? 0;
}

/** Splice each day-extra into the base list at its anchor (see DayOption). */
function applyDayOptions(base: readonly string[], extras: readonly DayOption[]): string[] {
  const options = [...base];
  for (const { option, after } of extras) {
    if (after === undefined) {
      options.push(option);
      continue;
    }
    const at = options.indexOf(after);
    if (at === -1) {
      throw new Error(`night review poll: anchor option not found: ${after}`);
    }
    options.splice(at + 1, 0, option);
  }
  return options;
}

/**
 * Build the poll for a given night. Defaults to now + config.timezone,
 * so the scheduler calls it with no args; the args exist for tests.
 */
export function buildNightReviewPoll(
  now: Date = new Date(),
  tz: string = config.timezone,
): PollSpec {
  const day = weekdayInTz(now, tz);
  // On a day nafl fasting is forbidden (Eid / أيام التشريق) there was no
  // fast to tick, so drop the fasting option — `now` is TODAY, the day the
  // poll reviews. Only fasting-flagged extras go; any future non-fasting
  // day option survives. The base nine deeds always stand.
  const allExtras = OPTIONS_BY_DAY[day] ?? [];
  const extras = noFastReason(now, tz) ? allExtras.filter((e) => !e.fasting) : allExtras;
  const options = applyDayOptions(BASE_OPTIONS, extras);

  return {
    question: QUESTION,
    options,
    isAnonymous: true,
    allowsMultipleAnswers: true,
    closeAfterHours: 22,
  };
}
