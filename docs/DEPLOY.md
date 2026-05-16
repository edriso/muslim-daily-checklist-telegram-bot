# Deployment

The bot is a long-polling Grammy process. It needs:

1. Node.js 20+ on a host that keeps long-lived processes alive.
2. A Telegram channel the bot is an admin of, with the "Post messages"
   permission. This is required for both the messages and the poll.
3. The environment variables below.

## Environment variables (.env at repo root)

| Variable            | Required | Notes                                                          |
| ------------------- | -------- | -------------------------------------------------------------- |
| `BOT_TOKEN`         | yes      | From @BotFather                                                |
| `CHANNEL_CHAT_ID`   | yes      | `@channel` or numeric `-100...`                                |
| `ADMIN_TELEGRAM_ID` | no       | Enables /admin\_\* commands. Empty = no admin commands work.   |
| `TZ_NAME`           | no       | Cron timezone. Code default UTC; `.env.example` = Africa/Cairo |
| `NODE_ENV`          | no       | `production` for hosted deploys                                |
| `PORT`              | no       | /health server port (default 8080)                             |

## Adding the bot to your channel

1. Open Channel settings, then Administrators, then Add admin.
2. Search for your bot username.
3. Grant at least the "Post messages" permission.

## Finding `CHANNEL_CHAT_ID`

- Public channel: use the `@` handle. `CHANNEL_CHAT_ID="@yourchannel"`.
- Private channel: forward any channel message to @username_to_id_bot.
  It returns the numeric `-100...` ID.

## Run locally

```bash
pnpm install
cp .env.example .env
# Edit .env
pnpm dev
```

Grant yourself admin (`ADMIN_TELEGRAM_ID`), then fire any schedule by
hand to confirm the channel receives it, e.g.:

```
/admin_run morning_azkar
/admin_run night_review_poll
```

## Railway

1. Deploy from GitHub repo.
2. Build: `pnpm install && pnpm build`
3. Start: `pnpm start`
4. Set the env vars listed above. Railway provides `PORT` automatically.

## Editing schedules

All rules live in `src/schedules.ts`. Each entry is `{ name, kind, cron,
... }` where `kind` is `'message'` (with `content`) or `'poll'` (with
`poll`). Add, remove, or edit entries and redeploy.

To change only the wording, edit the files in `src/content/`. Message
content is a fixed string, or an array (one random element is picked
each time it fires). The poll lives in `src/content/poll.ts`.

## Logs

Every scheduled fire and every send writes a line to stdout. PaaS
platforms capture stdout. To check whether today's posts ran, search
the log for the schedule name, `Posted message to channel`, or
`Posted poll to channel`.

## Healthcheck

```
GET /health
```

Returns `200 { status: "ok", uptimeSeconds }` while the process is up.
