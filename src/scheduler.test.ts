import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Bot, Context } from 'grammy';
import { runSchedule } from './scheduler';
import { findSchedule } from './schedules';
import type { ScheduleDef } from './types';
import { _resetForTests as resetState, getLastMessageId, setLastMessageId } from './lib/state';

/**
 * runSchedule must dispatch on `kind`: messages go through sendMessage,
 * polls go through sendPoll, and empty content posts nothing. No network.
 *
 * It must also implement replace-on-next-fire: a successful message
 * post updates the state pointer to the new message_id and deletes the
 * previously-tracked one. Polls are never tracked or deleted. A failed
 * post leaves state untouched so the next fire can still clean up.
 */

function fakeBot() {
  const sendMessage = vi.fn().mockResolvedValue({ message_id: 11 });
  const sendPoll = vi.fn().mockResolvedValue({ message_id: 22 });
  const deleteMessage = vi.fn().mockResolvedValue(true);
  const bot = {
    api: { sendMessage, sendPoll, deleteMessage },
  } as unknown as Bot<Context>;
  return { bot, sendMessage, sendPoll, deleteMessage };
}

// Wipe the in-memory pointer store between cases so one test's posts
// can never trigger the next test's "delete previous" path.
beforeEach(() => {
  resetState();
});

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
    const deleteMessage = vi.fn();
    const bot = {
      api: { sendMessage, sendPoll, deleteMessage },
    } as unknown as Bot<Context>;
    const def = findSchedule('evening_azkar')!;
    await expect(runSchedule(bot, def)).resolves.toBeNull();
  });
});

describe('runSchedule replace-on-next-fire (messages only)', () => {
  it('first fire posts and tracks the message_id but does NOT delete anything', async () => {
    const { bot, sendMessage, deleteMessage } = fakeBot();
    const def = findSchedule('morning_azkar')!;
    const id = await runSchedule(bot, def);
    expect(id).toBe(11);
    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(deleteMessage).not.toHaveBeenCalled();
    expect(getLastMessageId('morning_azkar')).toBe(11);
  });

  it('second fire posts the new copy and deletes the previously-tracked one', async () => {
    const sendMessage = vi
      .fn()
      .mockResolvedValueOnce({ message_id: 101 })
      .mockResolvedValueOnce({ message_id: 102 });
    const deleteMessage = vi.fn().mockResolvedValue(true);
    const bot = {
      api: { sendMessage, sendPoll: vi.fn(), deleteMessage },
    } as unknown as Bot<Context>;
    const def = findSchedule('morning_azkar')!;

    await runSchedule(bot, def);
    await runSchedule(bot, def);

    // Two posts, one delete (of the first).
    expect(sendMessage).toHaveBeenCalledTimes(2);
    expect(deleteMessage).toHaveBeenCalledTimes(1);
    expect(deleteMessage.mock.calls[0][1]).toBe(101);
    expect(getLastMessageId('morning_azkar')).toBe(102);

    // Post must happen before delete, never the other way around: in the
    // mock-call timeline the second sendMessage call records earlier
    // than the deleteMessage call.
    const order =
      sendMessage.mock.invocationCallOrder[1] < deleteMessage.mock.invocationCallOrder[0];
    expect(order).toBe(true);
  });

  it('a failed post leaves the previous pointer intact for next time', async () => {
    // Pre-seed a previous id so we can prove it survives a failed fire.
    await setLastMessageId('evening_azkar', 555);

    const sendMessage = vi.fn().mockRejectedValue(new Error('429'));
    const deleteMessage = vi.fn();
    const bot = {
      api: { sendMessage, sendPoll: vi.fn(), deleteMessage },
    } as unknown as Bot<Context>;
    const def = findSchedule('evening_azkar')!;

    await expect(runSchedule(bot, def)).resolves.toBeNull();

    // Pointer not advanced and delete not attempted — tomorrow we can
    // still try to clean up message 555.
    expect(deleteMessage).not.toHaveBeenCalled();
    expect(getLastMessageId('evening_azkar')).toBe(555);
  });

  it('a failed delete still advances the pointer (best-effort cleanup, log + continue)', async () => {
    await setLastMessageId('morning_azkar', 700);
    const sendMessage = vi.fn().mockResolvedValue({ message_id: 701 });
    const deleteMessage = vi.fn().mockRejectedValue(new Error('400 message to delete not found'));
    const bot = {
      api: { sendMessage, sendPoll: vi.fn(), deleteMessage },
    } as unknown as Bot<Context>;
    const def = findSchedule('morning_azkar')!;

    const id = await runSchedule(bot, def);

    expect(id).toBe(701);
    expect(deleteMessage).toHaveBeenCalledWith('@test_channel', 700);
    // Pointer moved to the new id even though delete failed — a stale
    // orphan is benign; double-attempting the same delete would not
    // help and would noise the logs.
    expect(getLastMessageId('morning_azkar')).toBe(701);
  });

  it('polls are NEVER tracked, even after multiple fires', async () => {
    const { bot, sendPoll, deleteMessage } = fakeBot();
    const def = findSchedule('night_review_poll')!;
    await runSchedule(bot, def);
    await runSchedule(bot, def);
    await runSchedule(bot, def);

    expect(sendPoll).toHaveBeenCalledTimes(3);
    expect(deleteMessage).not.toHaveBeenCalled();
    expect(getLastMessageId('night_review_poll')).toBeUndefined();
  });

  it('different schedules track their pointers independently', async () => {
    const sendMessage = vi
      .fn()
      .mockResolvedValueOnce({ message_id: 1 }) // morning
      .mockResolvedValueOnce({ message_id: 2 }) // evening
      .mockResolvedValueOnce({ message_id: 3 }) // morning again
      .mockResolvedValueOnce({ message_id: 4 }); // evening again
    const deleteMessage = vi.fn().mockResolvedValue(true);
    const bot = {
      api: { sendMessage, sendPoll: vi.fn(), deleteMessage },
    } as unknown as Bot<Context>;
    const morning = findSchedule('morning_azkar')!;
    const evening = findSchedule('evening_azkar')!;

    await runSchedule(bot, morning);
    await runSchedule(bot, evening);
    await runSchedule(bot, morning);
    await runSchedule(bot, evening);

    // First fire of each does no delete; second fires delete the first ids.
    expect(deleteMessage).toHaveBeenCalledTimes(2);
    const deletedIds = deleteMessage.mock.calls.map((c) => c[1]).sort();
    expect(deletedIds).toEqual([1, 2]);
    expect(getLastMessageId('morning_azkar')).toBe(3);
    expect(getLastMessageId('evening_azkar')).toBe(4);
  });
});
