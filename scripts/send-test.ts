/**
 * Manual test sender (development tool, NOT used by the running bot).
 *
 * It fires every schedule once via the SAME `runSchedule` the cron loop
 * uses, then exits. So:
 *
 *   - You see in the channel exactly what subscribers see for each
 *     schedule (no wrapper, no formatting drift). Each session is
 *     introduced by a short Arabic banner so anyone scrolling the
 *     channel knows the messages below it are dev previews, not real
 *     scheduled posts.
 *   - The delete-previous cleanup runs for the schedules: re-running
 *     `pnpm send-test` wipes the previous run's azkar/poll posts
 *     before posting fresh ones, so no manual cleanup is needed for
 *     them. The BANNER, however, is sent outside that tracking on
 *     purpose, so each test session leaves its own banner in the
 *     channel as a visible marker. Delete old banners by hand when
 *     you're done reviewing.
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
 * a real day (morning → Friday Kahf → evening azkar → fasting →
 * pre-sleep → poll) so the preview ends on the poll — the same final
 * thing subscribers see, with «سورة المُلك وأذكار النوم» as its last
 * option pointing back up to the pre-sleep message above.
 */
import { Bot, type Context } from 'grammy';
import { config } from '../src/config';
import { runSchedule } from '../src/scheduler';
import { schedules } from '../src/schedules';
import { initState } from '../src/lib/state';
import { postToChannel } from '../src/lib/post';

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

  // Session banner. Sent directly via postToChannel (NOT through
  // runSchedule), so it has no schedule name in the state file and
  // won't be auto-deleted on re-runs. The banner is meant to persist:
  // it marks each dev preview session in the channel scrollback so
  // anyone scrolling past knows the messages below it are tests, not
  // real scheduled posts. Old banners pile up by design — delete by
  // hand when you're done.
  const bannerId = await postToChannel(bot, '🧪 رسائل اختبار للبوت، يمكنك حذفها بعد المعاينة.', {
    scheduleName: 'test-banner',
  });
  if (bannerId === null) {
    console.error('Banner send failed — aborting. Check bot admin rights (Post messages).');
    process.exit(1);
  }
  console.log(`  test-banner: message ${bannerId}`);
  await sleep(1500);

  // Bail-on-first-failure for the real schedules too. If the first
  // schedule fire fails despite the banner having gone through
  // (something content-specific, or a sudden rate-limit), halt instead
  // of spamming N failures. After the first success the channel is
  // proven postable so later per-schedule failures are reported but
  // don't halt.
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
