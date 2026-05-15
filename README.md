# X Telegram Bot - Channel Scheduler (no database)

A minimal Telegram bot that posts scheduled messages to a single channel.
No database, no users, no votes. Just cron expressions plus content
arrays.

Built to be forked for any "post X at time Y" use case. A planned fork
posts daily Islamic azkar at fajr and maghrib.

## What is inside

```
x-telegram-bot-channel-no-db/
├── src/
│   ├── index.ts        Entry: load config, start bot + scheduler + health
│   ├── config.ts       BOT_TOKEN, CHANNEL_CHAT_ID, TZ_NAME, ADMIN_TELEGRAM_ID
│   ├── bot.ts          Grammy setup (/start, /admin_health, /admin_run)
│   ├── scheduler.ts    Registers each entry from src/schedules.ts with node-cron
│   ├── schedules.ts    THE FILE TO EDIT. List of (name, cron, content) rules
│   ├── health.ts       /health HTTP endpoint
│   ├── content/        Message arrays (morning / evening / tips by default)
│   └── lib/            logger, pick, post-to-channel
├── docs/DEPLOY.md
├── package.json
└── tsconfig.json
```

## Quick start

```bash
pnpm install

cp .env.example .env
# Edit .env: BOT_TOKEN, CHANNEL_CHAT_ID (required)
# Optional: ADMIN_TELEGRAM_ID, TZ_NAME

pnpm dev
```

Add the bot account to your channel as an admin with "Post messages"
permission. Without that, every post will 403.

## Default schedules

| Name      | Cron (in TZ_NAME) | What it does                                  |
| --------- | ----------------- | --------------------------------------------- |
| `morning` | `0 8 * * *`       | Random pick from `src/content/morning.ts`     |
| `evening` | `0 19 * * *`      | Random pick from `src/content/evening.ts`     |
| `tip`     | `30 14 * * *`     | Random pick from `src/content/tips.ts`        |

Edit `src/schedules.ts` to change cron times, swap content sources, or
add new entries. Each entry's `content` can be a single string (always
posted) or an array (one picked at random per tick).

If your `TZ_NAME` observes daylight saving time, avoid scheduling jobs
inside the spring-forward gap. For example in `Africa/Cairo` the clock
jumps from 00:00 to 01:00 on the last Friday of April, so cron times
in that hour are silently skipped that day. Keep your schedules at
01:00 or later when in doubt.

## Commands

| Command                 | Who    | What it does                            |
| ----------------------- | ------ | --------------------------------------- |
| `/start`                | anyone | Brief "this is channel-only" reply      |
| `/admin_health`         | admin  | Uptime, channel, registered schedules   |
| `/admin_run <name>`     | admin  | Manually fire one schedule by name      |

Admin is the Telegram user matching `ADMIN_TELEGRAM_ID`. If that env is
empty, no admin commands work.

## How forks work

For a domain-specific bot (e.g. daily Islamic azkar):

1. Replace `src/content/*.ts` with your own message files.
2. Edit `src/schedules.ts` to add or rename schedules and set their cron
   times.
3. Adjust `TZ_NAME` in .env to match your audience.
4. Push.

The bot itself does not need to change.

## License

MIT
