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

  const messages: Array<[string, string]> = [
    ['morning_azkar', morningAzkar],
    ['evening_azkar', eveningAzkar],
    ['pre_sleep', preSleepReminder],
    ['friday_kahf', fridayKahf],
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

  console.log('Done. Remember to delete these test posts from the channel.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Test send failed:', err);
  process.exit(1);
});
