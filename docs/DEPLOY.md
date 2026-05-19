# Deployment

The bot is a long-polling Grammy process. It needs:

1. Node.js 20+ on a host that keeps long-lived processes alive.
2. A Telegram channel the bot is an admin of, with **both**:
   - "Post messages" — required for the daily messages and the poll.
   - "Delete messages" — required for the replace-on-next-fire cleanup
     of repeating azkar. Without it the bot still posts; it just can't
     clean up, so the channel slowly accumulates dupes.
3. The environment variables below.
4. A writable working directory for the tiny pointer file (default
   `./data/last-message-ids.json`). Most hosts give you this for free.

## Environment variables (.env at repo root)

| Variable             | Required | Notes                                                          |
| -------------------- | -------- | -------------------------------------------------------------- |
| `BOT_TOKEN`          | yes      | From @BotFather                                                |
| `CHANNEL_CHAT_ID`    | yes      | Numeric `-100...` (recommended) or `@channel`. Not a URL.      |
| `CHANNEL_PUBLIC_URL` | no       | Public link shown only in `/start`. Decoupled from sending.    |
| `ADMIN_TELEGRAM_ID`  | no       | Enables /admin\_\* commands. Empty = no admin commands work.   |
| `TZ_NAME`            | no       | Cron timezone. Code default UTC; `.env.example` = Africa/Cairo |
| `STATE_FILE`         | no       | Pointer file path. Default `./data/last-message-ids.json`      |
| `NODE_ENV`           | no       | `production` for hosted deploys                                |
| `PORT`               | no       | /health server port (default 8080)                             |

`CHANNEL_CHAT_ID` should be the numeric id in production: it never
changes, so posting can never break if the channel username is renamed.
`CHANNEL_PUBLIC_URL` is purely cosmetic (the tap-through link in the
`/start` reply) and is safe to leave empty for a private channel.

## Adding the bot to your channel

1. Open Channel settings, then Administrators, then Add admin.
2. Search for your bot username.
3. Grant **"Post messages"** AND **"Delete messages"**. Post is for the
   daily reminders + poll; Delete is for the replace-on-next-fire
   cleanup that keeps the channel from accumulating dupes of repeating
   azkar. With Delete granted, the 48h `deleteMessage` cap does not
   apply, so even the weekly `friday_sunnah` post can be cleaned up
   when the next one fires.

## Finding `CHANNEL_CHAT_ID`

Get the numeric id and use it for both public and private channels:
forward any channel message to @username_to_id_bot and it returns the
`-100...` id. (A public `@handle` also works, but the numeric id is the
safer production choice because it survives a username change.)

For a public channel you also want the tap-through link in `/start`,
set `CHANNEL_PUBLIC_URL` to the share link, for example
`CHANNEL_PUBLIC_URL="https://t.me/yourchannel"`. Leave it empty for a
private channel.

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

## State file (`./data/last-message-ids.json`)

The bot writes one tiny JSON file mapping each message-schedule name to
its last posted `message_id`, so when the schedule fires again it can
delete the previous copy. Losing the file is not fatal — each schedule
just leaks one stale message until the next cycle replaces it. On hosts
with a persistent disk (Railway, VPS, Docker volume) cleanup is exact
across restarts; on ephemeral hosts it degrades to "one stale per
schedule per deploy". Override the path with `STATE_FILE` if needed.

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
