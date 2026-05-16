import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * startScheduler must register every schedule that has a valid cron and
 * silently skip the ones that do not, so a single typo in schedules.ts
 * never takes the whole bot down. node-cron and the schedule list are
 * mocked so this stays a pure, no-network unit test.
 */

const scheduleMock = vi.fn((_cron: string, _handler: unknown, _opts: unknown) => ({
  stop: vi.fn(),
}));
const validateMock = vi.fn((expr: string) => expr !== 'not a cron');

vi.mock('node-cron', () => ({
  default: { schedule: scheduleMock, validate: validateMock },
}));

vi.mock('./schedules', () => ({
  schedules: [
    { name: 'ok_message', kind: 'message', cron: '0 6 * * *', content: 'hi' },
    { name: 'broken', kind: 'message', cron: 'not a cron', content: 'never' },
    {
      name: 'ok_poll',
      kind: 'poll',
      cron: '43 21 * * *',
      poll: { question: 'q', options: ['a', 'b'] },
    },
  ],
}));

// Imported after the mocks so the mocked modules are wired in.
const { startScheduler, stopScheduler } = await import('./scheduler');

describe('startScheduler', () => {
  beforeEach(() => {
    scheduleMock.mockClear();
    validateMock.mockClear();
    stopScheduler(); // reset the module-level task list between cases
  });

  it('registers only valid-cron schedules and skips the invalid one', () => {
    const fakeBot = {} as never;
    const registered = startScheduler(fakeBot);

    expect(registered).toBe(2);
    expect(scheduleMock).toHaveBeenCalledTimes(2);

    const scheduledCrons = scheduleMock.mock.calls.map((call) => call[0]);
    expect(scheduledCrons).toEqual(['0 6 * * *', '43 21 * * *']);
    expect(scheduledCrons).not.toContain('not a cron');
  });

  it('stopScheduler stops every registered task', () => {
    const stops: Array<ReturnType<typeof vi.fn>> = [];
    scheduleMock.mockImplementation(() => {
      const stop = vi.fn();
      stops.push(stop);
      return { stop };
    });

    startScheduler({} as never);
    expect(stops).toHaveLength(2);

    stopScheduler();
    for (const stop of stops) expect(stop).toHaveBeenCalledTimes(1);
  });
});
