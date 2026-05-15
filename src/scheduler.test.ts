import { describe, it, expect, vi } from 'vitest';
import type { Bot, Context } from 'grammy';
import { runSchedule } from './scheduler';
import { findSchedule } from './schedules';
import type { ScheduleDef } from './types';

/**
 * runSchedule must dispatch on `kind`: messages go through sendMessage,
 * polls go through sendPoll, and empty content posts nothing. No network.
 */

function fakeBot() {
  const sendMessage = vi.fn().mockResolvedValue({ message_id: 11 });
  const sendPoll = vi.fn().mockResolvedValue({ message_id: 22 });
  const bot = { api: { sendMessage, sendPoll } } as unknown as Bot<Context>;
  return { bot, sendMessage, sendPoll };
}

describe('runSchedule dispatch', () => {
  it('a message schedule calls sendMessage, not sendPoll', async () => {
    const { bot, sendMessage, sendPoll } = fakeBot();
    const def = findSchedule('morning_azkar')!;
    expect(def.kind).toBe('message');
    const id = await runSchedule(bot, def);
    expect(id).toBe(11);
    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendPoll).not.toHaveBeenCalled();
  });

  it('the poll schedule calls sendPoll, not sendMessage', async () => {
    const { bot, sendMessage, sendPoll } = fakeBot();
    const def = findSchedule('night_review_poll')!;
    expect(def.kind).toBe('poll');
    const id = await runSchedule(bot, def);
    expect(id).toBe(22);
    expect(sendPoll).toHaveBeenCalledTimes(1);
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('a message schedule with empty array content posts nothing', async () => {
    const { bot, sendMessage, sendPoll } = fakeBot();
    const empty: ScheduleDef = {
      name: 'empty',
      kind: 'message',
      cron: '0 3 * * *',
      content: [],
    };
    const id = await runSchedule(bot, empty);
    expect(id).toBeNull();
    expect(sendMessage).not.toHaveBeenCalled();
    expect(sendPoll).not.toHaveBeenCalled();
  });

  it('propagates a null result when the send fails', async () => {
    const sendMessage = vi.fn().mockRejectedValue(new Error('boom'));
    const sendPoll = vi.fn();
    const bot = { api: { sendMessage, sendPoll } } as unknown as Bot<Context>;
    const def = findSchedule('evening_azkar')!;
    await expect(runSchedule(bot, def)).resolves.toBeNull();
  });
});
