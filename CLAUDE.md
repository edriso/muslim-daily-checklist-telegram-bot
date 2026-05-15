# Muslim Daily Checklist Bot — Repo Guide

## What this is

A no-database Telegram bot that posts daily Islamic reminders to one
channel and runs a nightly **anonymous** self-review poll. The poll is
anonymous + multiple-answer on purpose: Telegram aggregates the votes
and shows percentages to everyone, nobody (including this bot) learns
who voted. That delivers community motivation with no riya and no DB.

## Folder layout

```
muslim-daily-checklist-telegram-bot-channel/
├── src/
│   ├── index.ts        Entry point (config → bot → scheduler → health)
│   ├── config.ts       BOT_TOKEN, CHANNEL_CHAT_ID, ADMIN_TELEGRAM_ID, TZ_NAME
│   ├── bot.ts          Grammy setup, /start + admin commands
│   ├── scheduler.ts    node-cron registration; runSchedule() dispatch
│   ├── schedules.ts    THE EDIT POINT: the schedule list + findSchedule
│   ├── types.ts        ScheduleDef union + PollSpec (no import cycle)
│   ├── health.ts       /health HTTP endpoint
│   ├── content/        Arabic content modules + poll spec
│   └── lib/            logger, pick (random/static), post (msg + poll)
├── docs/DEPLOY.md
├── package.json
└── tsconfig.json
```

## Tech stack

| Layer    | Choice                                  |
| -------- | --------------------------------------- |
| Bot      | TypeScript, Grammy, node-cron, Node 20+ |
| Storage  | none                                    |
| Packager | pnpm                                    |

## Design choices

- **No database.** State lives in source: cron in `schedules.ts`,
  content in `content/`. Redeploy to change anything. This simplicity
  is a feature: fewer parts → it runs untouched for years.
- **Anonymous poll, not per-user tracking.** Streaks/personal history
  would need a DB and a subscriber bot, and re-introduce showing-off
  (riya). The anonymous poll keeps motivation without either. Do not
  "upgrade" this without a deliberate decision.
- **`ScheduleDef` is a discriminated union** (`kind: 'message' |
'poll'`). `scheduler.ts#runSchedule` switches on `kind`. Adding a
  schedule needs no other code change.
- **Channel text uses NO `parse_mode`.** Arabic du'a/Quran references
  contain `* _ ( ) <` etc. that Markdown/HTML would 400 on. Plain text
  renders Arabic + emoji perfectly. Deliberate simplicity-over-styling.
- **Poll options are `InputPollOption` objects.** Bot API 7.3+ changed
  `options` from strings to `{ text }[]`; `lib/post.ts` does the map.
- **`close_date` is clamped.** `sendPollToChannel` forces the close time
  into Telegram's 5s … ~30d window so bad config can't 400 the API.
- **Admin commands optional.** Empty `ADMIN_TELEGRAM_ID` → no-ops.
- **No retry on send failure.** Logged, tick lost, next fire takes over.

## Content authenticity (the spiritual core)

The bot's purpose is reward, so wrong attribution to the Prophet ﷺ is
the worst failure mode. Content in `src/content/` is sourced from
**حصن المسلم** with citations and carries a scholar-review notice.
Quran is referenced ("اقرأ سورة كذا"), not reproduced, to avoid
transcription error. Before any real launch the content must be
reviewed once by a trusted طالب علم. Keep that notice in the files.

## How to change what it posts

1. Message text → edit the file in `src/content/`.
2. The poll → edit `src/content/poll.ts` (stay anonymous + multi).
3. Times / new schedules → edit `src/schedules.ts`.
   The framework code does not need to change.

## Environment variables

| Variable            | Required | Notes                               |
| ------------------- | -------- | ----------------------------------- |
| `BOT_TOKEN`         | yes      | From @BotFather                     |
| `CHANNEL_CHAT_ID`   | yes      | `@channel` or numeric `-100...`     |
| `ADMIN_TELEGRAM_ID` | no       | Enables /admin\_\* commands         |
| `TZ_NAME`           | no       | Cron timezone, default Africa/Cairo |
| `NODE_ENV`          | no       | `production` for hosted             |
| `PORT`              | no       | /health server port (default 8080)  |

## Common gotchas

- The bot must be a channel admin with "Post messages" permission, or
  `sendMessage`/`sendPoll` 403s.
- Invalid cron is validated at boot, logged, and that one schedule is
  skipped; the rest still run.
- DST: node-cron silently drops a job whose wall-clock time does not
  exist on the spring-forward day. Africa/Cairo jumps 00:00 → 01:00 on
  the last Friday of April, so keep schedules at 02:00+ to be safe.
- Tests load `config.ts` transitively; `vitest.config.ts` injects dummy
  env so they need no real token.

## Testing

`pnpm test` — 33 tests, no network/DB: schedule + Telegram poll
constraints, `post.ts` success/failure mocks (incl. close_date
clamping), and `runSchedule` kind dispatch.

## Git

- Commit after each meaningful unit of work.
- Do NOT add Co-Authored-By in commit messages.
