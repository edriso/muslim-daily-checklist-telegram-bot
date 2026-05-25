/**
 * Manual welcome-message updater (development tool, NOT used by the
 * running bot's cron loop).
 *
 * The welcome lives in `src/content/welcome.ts`. Edit that file, then
 * run this script to push the change to the channel.
 *
 * Two modes:
 *
 *   pnpm post-welcome
 *     Posts a NEW message to the channel. Use this the first time you
 *     set up the channel. The script prints the message_id; pin that
 *     message manually in Telegram (channel → message → ⋮ → Pin), and
 *     keep the id somewhere so future updates can edit in place.
 *
 *   pnpm post-welcome <message_id>
 *     EDITS the existing message in place. The pin stays, no new
 *     notification fires. The bot can only edit messages it sent
 *     itself, so this only works if the original welcome was posted
 *     via this script (or via `bot.api.sendMessage` from any code
 *     using the same bot token).
 *
 * ── Why not auto-pin?
 *   Pinning needs the channel admin right "Pin messages", and pinning
 *   a brand-new edit re-fires the pin notification every time. So we
 *   keep pinning a one-shot manual step and use edit-in-place for
 *   updates — silent, no spam.
 *
 * ── Preflight
 *   Same one-call check as `send-test.ts`: `bot.api.getChat()` to fail
 *   fast on bad token / wrong chat id / invite-link slug pasted as id,
 *   instead of stacking a confusing post-time error.
 */
import { Bot, type Context } from 'grammy';
import { config } from '../src/config';
import { welcomeMessage } from '../src/content/welcome';
import { postToChannel } from '../src/lib/post';

const bot = new Bot<Context>(config.botToken);
const messageIdArg = process.argv[2];

async function main() {
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

  if (messageIdArg) {
    const messageId = Number(messageIdArg);
    if (!Number.isInteger(messageId) || messageId <= 0) {
      console.error(`Invalid message_id: "${messageIdArg}". Pass a positive integer.`);
      process.exit(1);
    }
    try {
      await bot.api.editMessageText(config.channelChatId, messageId, welcomeMessage);
      console.log(`Edited welcome message ${messageId} in ${config.channelChatId}.`);
      console.log('The pin (if any) stayed; no notification fired.');
    } catch (err) {
      console.error('Edit failed:', String(err));
      console.error(
        '  The bot can only edit messages it sent itself. If the original welcome was posted',
      );
      console.error(
        '  by a different account (or before this script existed), run with no args to post',
      );
      console.error('  a new one, then re-pin and remember the new message_id.');
      process.exit(1);
    }
  } else {
    const id = await postToChannel(bot, welcomeMessage, { scheduleName: 'welcome' });
    if (id === null) {
      console.error('Post failed. Check bot admin rights (Post messages).');
      process.exit(1);
    }
    console.log(`Posted welcome to ${config.channelChatId} as message ${id}.`);
    console.log('Next: pin this message in the channel (⋮ → Pin).');
    console.log(`To update later without re-pinning: pnpm post-welcome ${id}`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('Welcome script failed:', err);
  process.exit(1);
});
