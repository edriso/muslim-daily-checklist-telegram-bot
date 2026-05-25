/**
 * Manual test sender (development tool, NOT used by the running bot).
 *
 * It fires every schedule once via the SAME `runSchedule` the cron loop
 * uses, then exits. So:
 *
 *   - You see in the channel exactly what subscribers see — no banner,
 *     no test wrapper, no formatting drift.
 *   - The same delete-previous cleanup runs too. Run `pnpm send-test`
 *     twice and the second run wipes the first run's posts before
 *     posting fresh ones — no manual cleanup needed.
 *
 * One gotcha — cleanup is per-machine, not per-channel:
 *   The bot tracks what to delete in a small local file
 *   (`data/last-message-ids.json`) on whichever machine ran it. That
 *   file is NOT inside the channel and NOT tied to your credentials.
 *   So even if your laptop's `.env` points at the prod channel with
 *   prod's token, your laptop and the deployed server still keep
 *   separate files, and each side only deletes ids it wrote itself.
 *
 *   In practice: re-running `send-test` on the same machine cleans
 *   up after itself, but a test post from your laptop won't be
 *   cleaned up by a later prod cron fire (and vice versa). For any
 *   cross-machine leftovers, delete them from the channel by hand.
 *
 * ── How to run ────────────────────────────────────────────────────────
 *   1. Make sure `.env` has BOT_TOKEN and CHANNEL_CHAT_ID set, and that
 *      the bot is an admin of the channel with "Post messages" and
 *      "Delete messages" rights (the second matters from the 2nd run
 *      onwards, for cleanup).
 *   2. From the project root:
 *
 *        pnpm send-test
 *
 *      (equivalent to: pnpm exec tsx scripts/send-test.ts)
 *
 * Sends in the order declared by `schedules.ts`, which already mirrors
 * a real day (morning → Friday Kahf → evening azkar → fasting → poll →
 * pre-sleep) so the preview ends on the azkar, not on the poll.
 */
import { Bot, type Context } from 'grammy';
import { config } from '../src/config';
import { runSchedule } from '../src/scheduler';
import { schedules } from '../src/schedules';
import { initState } from '../src/lib/state';

const bot = new Bot<Context>(config.botToken);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  // Same init the real entry point does. Without it, runSchedule's
  // delete-previous step has no memory across runs and the script would
  // just stack duplicates each invocation.
  await initState(config.stateFilePath);

  // Preflight: validate token + channel id + bot membership in ONE call
  // before posting anything. Catches the common misconfig errors (wrong
  // token, wrong chat id, bot not in channel, or an invite-link slug
  // pasted as the chat id) with a single clean diagnostic instead of
  // six identical 400s scrolling past.
  try {
    await bot.api.getChat(config.channelChatId);
  } catch (err) {
    console.error('Preflight failed: cannot reach channel', config.channelChatId);
    console.error(
      '  CHANNEL_CHAT_ID must be numeric (e.g. -1001234567890) or @username — NOT an invite-link slug (+abc...).',
    );
    console.error('  Also check BOT_TOKEN is valid and the bot is a member of the channel.');
    console.error('  Underlying:', String(err));
    process.exit(1);
  }

  console.log('Sending test content to', config.channelChatId);

  // Bail-on-first-failure. If the FIRST fire fails (post-rights missing,
  // network down, etc.) the rest will too — abort early instead of
  // spamming N failures. After the first success the channel is proven
  // postable, so later per-schedule failures are reported but don't
  // halt — they're likely content-specific.
  let postedAtLeastOne = false;
  for (const def of schedules) {
    const id = await runSchedule(bot, def);
    console.log(`  ${def.name}: ${id === null ? 'FAILED' : 'message ' + id}`);
    if (id === null) {
      if (!postedAtLeastOne) {
        console.error('First fire failed — aborting. Check bot admin rights (Post messages).');
        process.exit(1);
      }
    } else {
      postedAtLeastOne = true;
    }
    await sleep(1500);
  }

  console.log('Done.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Test send failed:', err);
  process.exit(1);
});
