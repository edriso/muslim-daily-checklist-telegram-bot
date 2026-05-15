# X Telegram Bot - Channel Scheduler - Repo Guide

## What this is

A no-database Telegram bot that posts scheduled content to a single
channel. Designed to be forked for any "post X at time Y" pattern,
including daily Islamic azkar, motivational quotes, tips, reminders, etc.

## Folder layout

```
x-telegram-bot-channel-no-db/
├── src/
│   ├── index.ts        Entry point
│   ├── config.ts       Reads BOT_TOKEN, CHANNEL_CHAT_ID, ADMIN_TELEGRAM_ID, TZ_NAME
│   ├── bot.ts          Grammy setup, admin commands
│   ├── scheduler.ts    Registers schedules with node-cron, exposes runSchedule
│   ├── schedules.ts    THE EDIT POINT: array of (name, cron, content) defs
│   ├── health.ts       /health HTTP endpoint
│   ├── content/        Plain TS arrays of message strings
│   └── lib/            logger, pick (random/static), post (channel send)
├── docs/DEPLOY.md
├── package.json
└── tsconfig.json
```

## Tech stack

| Layer    | Choice                                       |
| -------- | -------------------------------------------- |
| Bot      | TypeScript, Grammy, node-cron, Node 20+      |
| Storage  | none                                         |
| Packager | pnpm                                         |

## Design choices

- **No database.** The bot is stateless. State lives in the source code:
  cron expressions in `src/schedules.ts`, content in `src/content/`.
  Re-deploying is the way to change schedules or messages.
- **Schedules are declarative.** Each entry in `schedules.ts` is one
  cron rule plus a content source. The scheduler iterates them at boot.
  Adding a new schedule requires no other code changes.
- **Content is either a fixed string or an array.** Single string = always
  the same post. Array = random pick per tick. See `src/lib/pick.ts`.
- **Channel ID is required at boot.** The bot exits if `CHANNEL_CHAT_ID`
  is missing. There is nothing useful to do otherwise.
- **Admin commands are optional.** If `ADMIN_TELEGRAM_ID` is empty,
  /admin_* commands are no-ops. Useful for a "set-and-forget" deploy.
- **Timezone is a single env var.** All schedules share `TZ_NAME`. Forks
  that need multiple timezones can extend `ScheduleDef` with a per-rule
  override.
- **No retry logic on send failure.** A failed post is logged and that
  tick is lost. The next scheduled fire takes over. For "must be
  delivered" workflows, add retry or a tiny SQLite store; this skeleton
  trades reliability for simplicity.

## How forks customise

Typical workflow for a domain fork (e.g. azkar bot):

1. Replace content files in `src/content/` with the new message lists.
2. Edit `src/schedules.ts` to add/rename schedules and set their cron times.
3. Set `TZ_NAME` in `.env` to the right timezone.
4. Done. The framework code does not need to change.

## Environment variables

| Variable             | Required | Notes                                          |
| -------------------- | -------- | ---------------------------------------------- |
| `BOT_TOKEN`          | yes      | From @BotFather                                |
| `CHANNEL_CHAT_ID`    | yes      | `@channel` or numeric `-100...`                |
| `ADMIN_TELEGRAM_ID`  | no       | Enables /admin_* commands                      |
| `TZ_NAME`            | no       | Cron timezone, default UTC                     |
| `NODE_ENV`           | no       | `production` for hosted                        |
| `PORT`               | no       | /health server port (default 8080)             |

## Common gotchas

- The bot must be a channel admin with "Post messages" permission.
  `sendMessage` will 403 otherwise.
- Cron expressions are validated at boot with `cron.validate`. An
  invalid expression is logged and that schedule is skipped, the others
  still run.
- `parse_mode: 'Markdown'` is hard-coded in `postToChannel`. If a
  message contains a stray `_` or `*`, Telegram will 400 it. Either
  escape user-controlled text or change the call to use plain text.
- DST gotcha: node-cron silently drops jobs whose time does not exist
  on the day the clock springs forward. For example in Africa/Cairo the
  wall clock jumps from 00:00 to 01:00 on the last Friday of April, so
  any cron between 00:00 and 00:59 is skipped that day. Keep schedules
  at 01:00 or later (or anywhere from 02:00 onward to be extra safe) if
  your `TZ_NAME` observes DST. Same rule applies to other DST zones.

## Git

- Commit after each meaningful unit of work.
- Do NOT add Co-Authored-By in commit messages.
