import { describe, it, expect } from 'vitest';
import cron from 'node-cron';
import { schedules, findSchedule } from './schedules';

/**
 * The schedules array is the central config. These tests guard against
 * easy mistakes: invalid cron expressions, duplicate names, empty
 * content, and so on. They run with no DB or network, so they catch
 * config errors before deploy.
 */
describe('schedules', () => {
  it('has at least one entry', () => {
    expect(schedules.length).toBeGreaterThan(0);
  });

  it('every entry has a valid cron expression', () => {
    for (const s of schedules) {
      expect(cron.validate(s.cron), `${s.name} cron should be valid`).toBe(true);
    }
  });

  it('every entry has a non-empty name', () => {
    for (const s of schedules) {
      expect(s.name.trim().length).toBeGreaterThan(0);
    }
  });

  it('names are unique', () => {
    const names = schedules.map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('every entry has content that resolves to something postable', () => {
    for (const s of schedules) {
      if (typeof s.content === 'string') {
        expect(s.content.trim().length).toBeGreaterThan(0);
      } else {
        expect(s.content.length).toBeGreaterThan(0);
      }
    }
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
