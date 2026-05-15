# Muslim Daily Checklist — Telegram Channel Bot

A small, no-database Telegram bot that posts daily Islamic reminders to
one channel and runs a **nightly anonymous self-review poll**.

The poll is the heart of it: every night the bot asks "what did you
complete today?" with the day's deeds as options. It is **anonymous and
multiple-answer**, so Telegram tallies the votes and shows everyone the
percentages — **nobody, not even this bot, sees who voted**. That gives
the community motivation ("most people kept their azkar today") with no
showing-off and no database.

## What it posts (default, Africa/Cairo)

| Name                | When            | What                                           |
| ------------------- | --------------- | ---------------------------------------------- |
| `morning_azkar`     | every day 06:00 | أذكار الصباح                                   |
| `evening_azkar`     | every day 16:30 | أذكار المساء                                   |
| `night_review_poll` | every day 21:00 | Anonymous self-review **poll** (the 5 deeds)   |
| `pre_sleep`         | every day 21:45 | سورة المُلك + أذكار النوم + نيّة قيام الليل    |
| `friday_kahf`       | Friday 07:00    | سورة الكهف + الإكثار من الصلاة على النبي ﷺ     |
| `fasting_reminder`  | Sun & Wed 20:00 | تذكير صيام الإثنين/الخميس (الليلة التي قبلهما) |

≈4 posts a day on purpose: too many notifications → people mute → a
muted channel benefits no one.

## ⚠️ Before going live: have the content reviewed

The Arabic texts in `src/content/` are sourced from **حصن المسلم** with
citations, but a bot whose whole purpose is reward must not risk
misattributing words to the Prophet ﷺ. **Have a trusted طالب علم review
`src/content/*.ts` once.** That single review is the most important step
in the project — it locks the benefit and removes the risk.

## Quick start

```bash
pnpm install

cp .env.example .env
# Edit .env: BOT_TOKEN, CHANNEL_CHAT_ID (required)
# Optional: ADMIN_TELEGRAM_ID, TZ_NAME (default Africa/Cairo)

pnpm dev
```

Add the bot to your channel as an admin with **"Post messages"**
permission, or every post (and the poll) will 403.

## Editing what it posts

Everything lives in source — no database, redeploy to change it.

- **Message text:** edit the matching file in `src/content/`.
- **The poll:** edit `src/content/poll.ts` (question + the 5 options;
  keep it anonymous + multi-answer).
- **Times / new entries:** edit `src/schedules.ts`. Each entry is one
  cron rule plus `kind: 'message'` or `kind: 'poll'`.

Cron is interpreted in `TZ_NAME`. Day-of-week: `0/7`=Sun … `5`=Fri.
Keep new times at **02:00 or later** — Cairo's DST spring-forward skips
the 00:00–00:59 hour once a year and node-cron drops jobs in that gap.

## Commands

| Command             | Who    | What                                        |
| ------------------- | ------ | ------------------------------------------- |
| `/start`            | anyone | Short "channel-only" reply (AR/EN)          |
| `/admin_health`     | admin  | Uptime, channel, registered schedules       |
| `/admin_run <name>` | admin  | Fire one schedule now (real end-to-end run) |

Admin = the Telegram user whose ID equals `ADMIN_TELEGRAM_ID`. Leave it
empty to disable admin commands entirely (set-and-forget deploy).

## Scripts

```bash
pnpm dev           # watch mode
pnpm build         # tsc → dist/
pnpm start         # run built bot
pnpm test          # vitest (33 tests, no network/DB)
pnpm typecheck     # tsc --noEmit
pnpm format        # prettier --write
```

## What this is NOT

No per-user tracking, no streaks, no personal history — those need a
database and a subscriber bot, and would re-introduce the riya problem
the anonymous poll avoids. This bot stays a simple, long-lived channel
poster. That simplicity is intentional: fewer moving parts → it keeps
running for years untouched.

## License

MIT
