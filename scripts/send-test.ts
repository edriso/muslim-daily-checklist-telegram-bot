/**
 * Manual test sender (development tool, NOT used by the running bot).
 *
 * It posts every content message + the poll to your channel once, then
 * exits. Use it to eyeball the exact text/formatting subscribers will
 * see, without waiting for a cron time and without needing admin rights
 * on the bot (unlike the in-chat `/admin_run` command).
 *
 * ── How to run ────────────────────────────────────────────────────────
 *   1. Make sure `.env` has BOT_TOKEN and CHANNEL_CHAT_ID set, and that
 *      the bot is an admin of that channel with "Post messages".
 *   2. From the project root:
 *
 *        pnpm send-test
 *
 *      (equivalent to: pnpm exec tsx scripts/send-test.ts)
 *
 *   3. Open the channel, review the posts, then DELETE them — they are
 *      test posts, not real scheduled content.
 *
 * It reuses the real postToChannel / sendPollToChannel, so this is a
 * true end-to-end check of the exact code the scheduler runs in prod.
 */
import { Bot, type Context } from 'grammy';
import { config } from '../src/config';
import { postToChannel, sendPollToChannel } from '../src/lib/post';
import { morningAzkar } from '../src/content/morningAzkar';
import { eveningAzkar } from '../src/content/eveningAzkar';
import { preSleepReminder } from '../src/content/preSleep';
import { fridayKahf } from '../src/content/fridayKahf';
import { fastingReminder } from '../src/content/fasting';
import { nightReviewPoll } from '../src/content/poll';

const bot = new Bot<Context>(config.botToken);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log('Sending test content to', config.channelChatId);

  await postToChannel(
    bot,
    '🧪 رسائل اختبار للبوت، يمكنك حذفها بعد المعاينة.\nهذه ليست نِيّةً للنشر، إنما لفحص الشكل فقط.',
    { scheduleName: 'test-banner' },
  );
  await sleep(1500);

  // Ordered to mirror a real day so the preview reads the way
  // subscribers see it: morning, then Friday Kahf, then the evening
  // azkar, then the Sun/Wed fasting reminder. The poll and the
  // pre-sleep reminder are sent after, in the same order as the bedtime
  // cluster (poll, then pre-sleep last) so the preview also ends on the
  // azkar, not on the poll.
  const messages: Array<[string, string]> = [
    ['morning_azkar', morningAzkar],
    ['friday_kahf', fridayKahf],
    ['evening_azkar', eveningAzkar],
    ['fasting_reminder', fastingReminder],
  ];

  for (const [name, text] of messages) {
    const id = await postToChannel(bot, text, { scheduleName: name });
    console.log(`  ${name}: ${id === null ? 'FAILED' : 'message ' + id}`);
    await sleep(1500);
  }

  const pollId = await sendPollToChannel(bot, nightReviewPoll, {
    scheduleName: 'night_review_poll',
  });
  console.log(`  night_review_poll: ${pollId === null ? 'FAILED' : 'message ' + pollId}`);
  await sleep(1500);

  const preSleepId = await postToChannel(bot, preSleepReminder, {
    scheduleName: 'pre_sleep',
  });
  console.log(`  pre_sleep: ${preSleepId === null ? 'FAILED' : 'message ' + preSleepId}`);

  console.log('Done. Remember to delete these test posts from the channel.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Test send failed:', err);
  process.exit(1);
});
