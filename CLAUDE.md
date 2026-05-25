# Muslim Daily Checklist Bot: Repo Guide

## What this is

A near-zero-state Telegram bot that posts daily Islamic reminders to one
channel and runs a nightly **anonymous** self-review poll. The poll is
anonymous + multiple-answer on purpose: Telegram aggregates the votes
and shows percentages to everyone, nobody (including this bot) learns
who voted. That delivers community motivation with no riya and no DB.

Repeating reminders (azkar) auto-replace each other — the channel keeps
one live copy per schedule, not a year of identical dupes. Polls and
any human-posted message (your welcome / pinned intro) are never
touched. See the "Replace-on-next-fire" design choice below.

## Folder layout

```
muslim-daily-checklist-telegram-bot-channel/
├── src/
│   ├── index.ts        Entry point (config → bot → scheduler → health)
│   ├── config.ts       env: BOT_TOKEN, CHANNEL_CHAT_ID, CHANNEL_PUBLIC_URL, ...
│   ├── bot.ts          Grammy setup, /start + admin commands
│   ├── scheduler.ts    node-cron registration; runSchedule() dispatch
│   ├── schedules.ts    THE EDIT POINT: the schedule list + findSchedule
│   ├── types.ts        ScheduleDef union + PollSpec (no import cycle)
│   ├── health.ts       /health HTTP endpoint
│   ├── content/        Arabic content modules + poll spec
│   └── lib/            logger, pick, post (msg+poll+delete), state
├── scripts/send-test.ts  Manual dev sender (not imported by the app)
├── data/               Tiny pointer file (gitignored). Auto-created.
├── docs/DEPLOY.md
├── package.json
└── tsconfig.json
```

## Tech stack

| Layer    | Choice                                                      |
| -------- | ----------------------------------------------------------- |
| Bot      | TypeScript, Grammy, node-cron, Node 20+                     |
| Storage  | none, except one tiny JSON pointer file (see "No database") |
| Packager | pnpm                                                        |

## Design choices

- **No database.** Config and content live in source: cron in
  `schedules.ts`, content in `content/`. Redeploy to change anything.
  This simplicity is a feature: fewer parts → it runs untouched for
  years. One deliberate carve-out: `src/lib/state.ts` keeps a tiny JSON
  pointer file (`{ scheduleName: messageIds[] }`, default
  `./data/last-message-ids.json`) so the replace / ring-buffer delete
  survives a restart. It is NOT state-as-truth — no schema, no queries;
  same conceptual weight as `.env`. Losing the file just means each
  schedule leaks a handful of stale messages until they age out of the
  ring buffer. The reader accepts the pre-ring-buffer single-number
  shape too, so old state files migrate transparently.
- **Ring-buffer cleanup (per-schedule `keepLast`).** Repeating posts
  would otherwise accumulate (a year of identical azkar; a year of
  identical-question polls) and bury the welcome / pinned intro for
  new joiners. So each schedule has an effective `keepLast`:
  - messages default to **1** → exactly one live copy (the old
    replace-on-next-fire rule, unchanged).
  - polls default to **0** → never tracked, never deleted.
  - `night_review_poll` overrides to **1** → same replace-on-next-fire
    rule as messages. Tonight's poll fires, last night's is deleted.
    One live poll in the channel at any time. Yesterday's tally goes
    with it — judged not worth the daily stack of identical-question
    polls. The N > 1 code path is still supported (see scheduler.ts)
    but unused in prod.

  Order is post-then-trim so the channel is never empty mid-cycle. Any
  message NOT posted via this code path (your welcome / pinned intro,
  other admins) is never tracked here, and therefore never deleted.
  See `scheduler.ts#runSchedule` + `lib/state.ts`.
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
- **Poll text is bidi-isolated (`rtlIsolate`).** Each option + the
  question is wrapped in Unicode RLI…PDI (U+2067…U+2069) in
  `lib/post.ts`. With no `parse_mode` the HTML `dir="rtl"` fix is out;
  the isolate is the standards-correct plain-text equivalent — it pins
  the line RTL and walls it off from the vote %/count Telegram appends,
  which was rendering on top of the emoji. Content also keeps the emoji
  at the _end_ of each string (see `content/poll.ts`). Keep both.
- **`close_date` is clamped.** `sendPollToChannel` forces the close time
  into Telegram's 5s … ~30d window so bad config can't 400 the API.
- **Admin commands optional.** Empty `ADMIN_TELEGRAM_ID` → no-ops.
- **No retry on send failure.** Logged, tick lost, next fire takes over.

## Content authenticity (the spiritual core)

The bot's purpose is reward, so wrong attribution to the Prophet ﷺ is
the worst failure mode. Every file in `src/content/` is verified
against its sources — Bukhari, Muslim, the Sunan with their gradings,
and the canonical **حصن المسلم** — and lists its own takhreej (تحقيق)
plus a scholar-review notice. Quran is referenced ("اقرأ سورة كذا"),
not reproduced, to avoid transcription error; where a du'a echoes an
ayah it is marked as a du'a, not a Prophetic (marfūʿ) text. Before any
real launch the content must be reviewed once by a trusted طالب علم.
Keep those notices in the files.

## How to change what it posts

1. Message text → edit the file in `src/content/`.
2. The poll → edit `src/content/poll.ts` (stay anonymous + multi;
   keep any emoji at the **end** of each option/question and leave a
   little margin under 100 chars — `rtlIsolate` adds 2; see below).
3. Times / new schedules → edit `src/schedules.ts`.
   The framework code does not need to change.

## Environment variables

| Variable             | Required | Notes                                                             |
| -------------------- | -------- | ----------------------------------------------------------------- |
| `BOT_TOKEN`          | yes      | From @BotFather                                                   |
| `CHANNEL_CHAT_ID`    | yes      | Numeric `-100...` (recommended) or `@channel`                     |
| `CHANNEL_PUBLIC_URL` | no       | Public link for `/start` only; decoupled from sending             |
| `ADMIN_TELEGRAM_ID`  | no       | Enables /admin\_\* commands                                       |
| `TZ_NAME`            | no       | Cron timezone. Code default UTC; `.env.example` sets Africa/Cairo |
| `STATE_FILE`         | no       | Pointer file path. Default `./data/last-message-ids.json`         |
| `NODE_ENV`           | no       | `production` for hosted                                           |
| `PORT`               | no       | /health server port (default 8080)                                |

`CHANNEL_CHAT_ID` is sent to Telegram as-is; the numeric id is the safe
production choice because it survives a username rename. The public
link is deliberately a separate, optional variable so the cosmetic link
can never break posting. If `CHANNEL_PUBLIC_URL` is unset, the link
falls back to deriving from an `@username` chat id, else `/start` shows
no link.

## Common gotchas

- The bot must be a channel admin with **two** rights granted:
  - **"Post messages"** — without it `sendMessage`/`sendPoll` 403s.
  - **"Delete messages"** (`can_delete_messages`) — without it the
    replace-on-next-fire cleanup fails. This admin right also removes
    Telegram's 48h `deleteMessage` cap, which matters because
    `friday_sunnah` is weekly (its previous copy is 7 days old). The
    failure is non-fatal (logged), so an unconfigured deploy still
    posts; old copies just accumulate until the right is granted.
- Invalid cron is validated at boot, logged, and that one schedule is
  skipped; the rest still run.
- DST: node-cron silently drops a job whose wall-clock time does not
  exist on the spring-forward day. Africa/Cairo jumps 00:00 → 01:00 on
  the last Friday of April, so keep schedules at 02:00+ to be safe.
- Tests load `config.ts` transitively; `vitest.config.ts` injects dummy
  env so they need no real token.
- Ephemeral hosting (Heroku-style) wipes `data/` on every deploy. The
  bot still works — it just degrades to "one stale copy per schedule
  per deploy" until the next cycle. On hosts with a persistent disk
  (Railway, VPS, Docker volume) cleanup is exact across restarts.

## Testing

`pnpm test` runs fast unit tests with no network or database. They
cover: schedule and Telegram poll constraints, `post.ts` success and
failure mocks (including close_date clamping and `deleteChannelMessage`),
`runSchedule` kind dispatch + the `keepLast` ring buffer (first fire
posts only, message-default-1 deletes previous on second fire, polls
without `keepLast` are never tracked, the synthetic `keepLast: 2` case
fills then evicts oldest on third fire, failed posts leave state,
`night_review_poll` is wired for replace-on-next-fire with `keepLast: 1`),
`lib/state.ts` (empty/corrupt file resilience,
legacy single-number migration, array round-trip, clear-on-empty,
parent-dir creation), `startScheduler` skipping an invalid cron,
`pickContent` (blank and array handling), `channelUrlFrom`, and
`resolvePort`. The count is intentionally not stated here so it never
goes stale.

`pnpm send-test` runs `scripts/send-test.ts`: a manual dev tool that
posts every message + the poll to the channel once and exits. It needs
`.env` (BOT_TOKEN + CHANNEL_CHAT_ID) but NOT bot-admin rights (unlike
`/admin_run`). It reuses the real send code, so it is a true
end-to-end check. Not imported by the app; safe to keep in the repo.

## Git

- Commit after each meaningful unit of work.
- Do NOT add Co-Authored-By in commit messages.
