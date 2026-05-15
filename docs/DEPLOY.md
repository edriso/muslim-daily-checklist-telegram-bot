# Deployment

The bot is a long-polling Grammy process. It needs:

1. Node.js 20+ on a host that keeps long-lived processes alive.
2. A Telegram channel the bot is admin of (with "Post messages"
   permission).
3. The environment variables below.

## Environment variables (.env at repo root)

| Variable             | Required | Notes                                                       |
| -------------------- | -------- | ----------------------------------------------------------- |
| `BOT_TOKEN`          | yes      | From @BotFather                                             |
| `CHANNEL_CHAT_ID`    | yes      | `@channel` or numeric `-100...`                             |
| `ADMIN_TELEGRAM_ID`  | no       | Enables /admin_* commands. Empty = no admin commands work.  |
| `TZ_NAME`            | no       | Cron timezone, default UTC. Examples: `Africa/Cairo`        |
| `NODE_ENV`           | no       | `production` for hosted deploys                             |
| `PORT`               | no       | /health server port (default 8080)                          |

## Adding the bot to your channel

1. Channel settings -> Administrators -> Add admin.
2. Search for your bot username.
3. Grant at least "Post messages".

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

Use `/admin_run morning` (after granting yourself admin) to fire any
schedule by hand and confirm the channel receives it.

## Railway

1. Deploy from GitHub repo.
2. Build: `pnpm install && pnpm build`
3. Start: `pnpm start`
4. Set the env vars listed above. Railway provides `PORT` automatically.

## Editing schedules

All schedule rules live in `src/schedules.ts`. Each entry is a `{ name,
cron, content }` object. Add, remove, or edit entries and redeploy.

To change just the content (not the cron times), edit the files in
`src/content/`. The scheduler picks a fresh random element each tick.

## Logs

Every scheduled fire and every send writes a line to stdout. PaaS
platforms capture stdout. To check whether today's posts ran, search
the log for the schedule name or `Posted to channel`.

## Healthcheck

```
GET /health
```

Returns `200 { status: "ok", uptimeSeconds }` while the process is up.
