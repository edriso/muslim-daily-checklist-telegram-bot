import { describe, it, expect } from 'vitest';
import cron from 'node-cron';
import { schedules, findSchedule } from './schedules';
import { MIN_CLOSE_HOURS, MAX_CLOSE_HOURS, rtlIsolate } from './lib/post';

/**
 * The schedules array is the central config. These tests guard against
 * easy mistakes (bad cron, duplicate names, empty content) and against
 * Telegram's poll limits, so config errors are caught before deploy —
 * no DB or network needed.
 */

// Telegram limits we rely on.
const MAX_MESSAGE_CHARS = 4096;
const MAX_QUESTION_CHARS = 255; // Telegram allows 300; we keep a margin.
const MAX_OPTION_CHARS = 100;

describe('schedules (general)', () => {
  it('has at least one entry', () => {
    expect(schedules.length).toBeGreaterThan(0);
  });

  it('every entry has a valid cron expression', () => {
    for (const s of schedules) {
      expect(cron.validate(s.cron), `${s.name} cron should be valid`).toBe(true);
    }
  });

  it('every entry has a non-empty name and a known kind', () => {
    for (const s of schedules) {
      expect(s.name.trim().length).toBeGreaterThan(0);
      expect(['message', 'poll']).toContain(s.kind);
    }
  });

  it('names are unique', () => {
    const names = schedules.map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('all fixed-hour schedules are at 02:00 or later (Cairo DST gap)', () => {
    for (const s of schedules) {
      const hour = s.cron.split(/\s+/)[1];
      // Only assert for fixed numeric hours (skip "*", ranges, lists).
      if (/^\d+$/.test(hour)) {
        expect(Number(hour), `${s.name} hour must be >= 2`).toBeGreaterThanOrEqual(2);
      }
    }
  });
});

describe('message schedules', () => {
  const messageSchedules = schedules.filter((s) => s.kind === 'message');

  it('there is at least one message schedule', () => {
    expect(messageSchedules.length).toBeGreaterThan(0);
  });

  it('content resolves to something postable within Telegram limits', () => {
    for (const s of messageSchedules) {
      if (s.kind !== 'message') continue; // narrow for TS
      const items = typeof s.content === 'string' ? [s.content] : s.content;
      expect(items.length, `${s.name} has no content`).toBeGreaterThan(0);
      for (const text of items) {
        expect(text.trim().length, `${s.name} has empty content`).toBeGreaterThan(0);
        expect(text.length, `${s.name} message too long`).toBeLessThanOrEqual(MAX_MESSAGE_CHARS);
      }
    }
  });
});

describe('poll schedules', () => {
  const pollSchedules = schedules.filter((s) => s.kind === 'poll');

  it('there is exactly one poll schedule (the nightly review)', () => {
    expect(pollSchedules.length).toBe(1);
  });

  it('the poll obeys every Telegram constraint', () => {
    for (const s of pollSchedules) {
      if (s.kind !== 'poll') continue; // narrow for TS
      const p = s.poll;
      expect(p.question.trim().length).toBeGreaterThan(0);
      // Validate the length we ACTUALLY transmit: lib/post.ts wraps the
      // question + every option in rtlIsolate (RLI..PDI = +2 code
      // points). Telegram's limit applies to the sent string, so a near
      // -limit author string must still fit after the wrap, or sendPoll
      // 400s. Same defensive spirit as the close_date clamp.
      expect(rtlIsolate(p.question).length).toBeLessThanOrEqual(MAX_QUESTION_CHARS);

      expect(p.options.length).toBeGreaterThanOrEqual(2);
      expect(p.options.length).toBeLessThanOrEqual(10);
      for (const opt of p.options) {
        expect(opt.trim().length).toBeGreaterThan(0);
        expect(rtlIsolate(opt).length).toBeLessThanOrEqual(MAX_OPTION_CHARS);
      }

      // Options must be distinct, or the percentages are meaningless.
      expect(new Set(p.options).size).toBe(p.options.length);

      if (p.closeAfterHours !== undefined) {
        expect(p.closeAfterHours).toBeGreaterThanOrEqual(MIN_CLOSE_HOURS);
        expect(p.closeAfterHours).toBeLessThanOrEqual(MAX_CLOSE_HOURS);
      }
    }
  });

  it('the review poll is anonymous and multi-answer (the whole point)', () => {
    const review = findSchedule('night_review_poll');
    expect(review?.kind).toBe('poll');
    if (review?.kind === 'poll') {
      // Defaults are anonymous + multi; assert they are not disabled.
      expect(review.poll.isAnonymous).not.toBe(false);
      expect(review.poll.allowsMultipleAnswers).not.toBe(false);
    }
  });
});

describe('bedtime window order', () => {
  // Guards the documented design: pre_sleep fires BEFORE night_review_poll,
  // so the poll is the last message in the channel. A user who sees the
  // gap «سورة المُلك وأذكار النوم» in the poll scrolls UP to the pre-sleep
  // message above it and acts on the dhikr. See schedules.ts header.
  function minutesFromTopOfDay(cronExpr: string): number {
    const [m, h] = cronExpr.split(/\s+/).map(Number);
    return h * 60 + m;
  }

  it('pre_sleep fires before night_review_poll on the same day', () => {
    const presleep = findSchedule('pre_sleep');
    const poll = findSchedule('night_review_poll');
    expect(presleep, 'pre_sleep must exist').toBeDefined();
    expect(poll, 'night_review_poll must exist').toBeDefined();
    expect(minutesFromTopOfDay(presleep!.cron)).toBeLessThan(minutesFromTopOfDay(poll!.cron));
  });
});

describe('findSchedule', () => {
  it('finds a schedule by name', () => {
    const first = schedules[0];
    expect(findSchedule(first.name)?.name).toBe(first.name);
  });

  it('returns undefined for an unknown name', () => {
    expect(findSchedule('definitely-not-real')).toBeUndefined();
  });
});
