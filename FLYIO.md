# Deploying Zaaduna on Fly.io

This file is everything you need to know about running this bot on
[Fly.io](https://fly.io). It is written in simple steps so a new
developer can follow it without prior Fly.io experience.

If you ever move the bot to another host (Railway, Hetzner, a VPS,
Docker on your laptop), this file is also your "what to keep, what to
delete" map — see the last section.

## What lives where

### Fly-specific (delete these if you leave Fly)

- **`fly.toml`** — Fly app config. App name, region, kill signals,
  process group, VM size. No other host reads this file.

### Portable (keep them on any host that runs containers)

- **`Dockerfile`** — Two-stage Node 22 alpine build. Works on Fly,
  Railway, Render, a VPS, Kubernetes — anywhere that runs containers.
- **`.dockerignore`** — Pairs with the Dockerfile. Keep as-is.

### Documentation

- **`docs/DEPLOY.md`** — Generic deploy notes (env vars, channel
  admin rights, state file). Read it once, then come back here.
- **`.env.example`** — The full env-var contract. Same vars work on
  every host. Only the way you SET them changes (Fly secrets here vs
  Railway dashboard vs systemd EnvironmentFile vs ...).

## Why these choices

### No `[http_service]` block in fly.toml

The bot has no public website or API. The `/health` server on port
8080 is INTERNAL only (for the process itself / debugging via
`fly ssh console`).

The bot talks to Telegram using **long-polling** — it keeps reaching
out to Telegram to ask "any new updates?". That outbound connection
makes Fly see the machine as "in use" and Fly will NOT auto-stop it.

Adding `[http_service]` would:

- Open a public port for nothing.
- Pull in the `auto_stop_machines = 'stop'` default, which scales the
  machine to zero when there are no incoming requests. A long-polling
  bot has no incoming requests, so Fly would stop it within minutes
  and the bot would go silent.

**If Fly's web UI ever offers to merge a `flyio-new-files` branch,
DO NOT MERGE IT.** Its auto-generated `fly.toml` adds `[http_service]`
and breaks the design.

### Two-stage Dockerfile with `--ignore-scripts`

The first deploy on Fly failed with:

```
ERR_PNPM_IGNORED_BUILDS: Ignored build scripts: esbuild@0.27.7
```

pnpm 11 refuses to run any dependency install-script unless you
approve it. We don't actually need esbuild's postinstall (or any
other dependency's lifecycle script) at runtime, so the simplest fix
is `pnpm install --frozen-lockfile --ignore-scripts` in both stages.

Why not allowlist esbuild via `pnpm.onlyBuiltDependencies`?
pnpm 11 prints a warning that the `pnpm` field in package.json is no
longer read, so that allowlist is dead. `--ignore-scripts` is the
maintained replacement.

### `tsx` is a regular dependency, not a dev dependency

The start command is `node --import tsx dist/index.js`. tsx runs
even after `tsc` compiled the code, because the source uses
extension-less ESM imports (`from './config'` instead of
`from './config.js'`), and Node's strict ESM resolver wants the
extensions. tsx provides an import hook that resolves them at
runtime. So `tsx` must be present in the prod image.

If you ever want to drop tsx from production, the alternative is a
small post-`tsc` script that adds `.js` extensions to the relative
imports in `dist/`. Not done here — keeping tsx is simpler for now.

### App name, region, single machine

- App name: `zaaduna`. Update it in `fly.toml` AND re-run
  `fly apps create <newname>` if you pick a different name.
- Region: `cdg` (Paris) by default. Pick a region close to your
  audience from https://fly.io/docs/reference/regions/ and update
  `fly.toml`. Latency does not matter much here — the bot talks to
  Telegram's API, not to your users directly.
- One machine, not two. Fly's launch flow defaults to 2 machines
  for high availability. For this bot that's actively harmful: two
  bots with the same `BOT_TOKEN` would both long-poll and fight
  over each update. Pin to 1 once after the first deploy:

  ```bash
  fly machine destroy <extra-machine-id> -a zaaduna --force
  fly scale count 1 -a zaaduna
  ```

  After that, future `fly deploy` updates the single machine in
  place. There is no equivalent setting in `fly.toml` for this —
  `fly scale count` is the only switch.

### State file (`./data/last-message-ids.json`)

The bot writes a tiny JSON file mapping each message-schedule name
to the message_ids it posted, so when the schedule fires again it
can delete the previous copy.

On Fly's default setup, **this file is wiped on every deploy**
(a new image means a new root filesystem). Losing it is not fatal —
each schedule just leaks ONE stale message in the channel until the
next time it fires and overwrites the pointer. The CLAUDE.md
section "Replace-on-next-fire" explains this in more detail.

If you want exact cleanup across deploys, attach a Fly volume:

```bash
fly volume create zaaduna_data --region cdg --size 1 -a zaaduna
```

Then add this to `fly.toml`:

```toml
[mounts]
  source = "zaaduna_data"
  destination = "/app/data"
```

For the size of this state, even 1 GB is huge overkill — the file
is a few hundred bytes. The volume is purely for persistence.

## One-time setup

```bash
# 1. Install flyctl
curl -L https://fly.io/install.sh | sh
source ~/.bashrc

# 2. Log in (opens a browser)
fly auth login

# 3. Reserve the app name (only the first time)
fly apps create zaaduna

# 4. Set every secret. Quote each value so the shell does not eat
#    special characters in tokens.
fly secrets set BOT_TOKEN='123456789:AAFakeExampleTokenFromBotFather'
fly secrets set CHANNEL_CHAT_ID='-1003723418314'
fly secrets set TZ_NAME='Africa/Cairo'

# Optional but recommended:
fly secrets set ADMIN_TELEGRAM_ID='123456789'
fly secrets set CHANNEL_PUBLIC_URL='https://t.me/yourchannel'

# NODE_ENV is already set to "production" in fly.toml under [env],
# so you do NOT need to set it as a secret.

# 5. First deploy
fly deploy
```

After the first deploy you should see ~2 machines come up (Fly's HA
default). Pin to 1 (see the "single machine" section above):

```bash
fly status -a zaaduna                      # list machines
fly machine destroy <extra-id> -a zaaduna --force
fly scale count 1 -a zaaduna
```

Then make sure the bot is a channel admin with BOTH "Post messages"
AND "Delete messages" granted (see `docs/DEPLOY.md`).

## Day-to-day commands

```bash
fly deploy                          # build and ship the current working tree
fly logs -a zaaduna                 # tail the live machine output (Ctrl+C to stop)
fly status -a zaaduna               # machine state, last deploy, region
fly machine list -a zaaduna         # every machine, with id and state
fly releases -a zaaduna             # deploy history, newest first
fly ssh console -a zaaduna          # shell into the running machine
fly secrets list -a zaaduna         # see which env vars are set (values hidden)
fly secrets set KEY=value           # add or update a secret (auto-restarts)
fly machines restart -a zaaduna     # restart without redeploying
```

Tip: machine ids show up in `fly status` and `fly machine list`.
They look like `d8d3925a3e2638`.

### Check what value a secret actually has

`fly secrets list` only shows names, not values, on purpose. If you
just rotated `BOT_TOKEN` and want to confirm what the live bot sees:

```bash
fly ssh console -a zaaduna -C 'printenv BOT_TOKEN'
```

Do NOT paste the output into chat or a commit.

### Auto-Deploy on push: keep it OFF

In the Fly dashboard, Settings → Auto-Deploy on push. Leave it OFF.
Manual deploys (`fly deploy`) cleanly separate "I committed code"
from "I want this live", and you avoid surprise deploys when you
push a docs-only change.

```bash
git push       # safe at any time, never deploys
fly deploy     # only when you actually want to ship
```

## Triage: the bot looks dead in the channel

Work through these in order. Stop at the first one that explains it.

### 1. Is the machine running?

```bash
fly status -a zaaduna
fly machine list -a zaaduna
```

| State                    | What it means                                   | What to do                                |
| ------------------------ | ----------------------------------------------- | ----------------------------------------- |
| `started`                | Machine is up. Problem is elsewhere.            | Go to step 2.                             |
| `stopped`                | Machine is off (manual stop, or crash cap hit). | `fly machine start <id> -a zaaduna`.      |
| restart-looping/`failed` | Code or config crashes on boot.                 | Go to step 2 to read the logs.            |
| machine missing entirely | Fly tore it down (rare).                        | `fly deploy` creates a fresh one.         |

### 2. What do the logs say?

```bash
fly logs -a zaaduna
```

Let it stream for ~30 seconds. Look for:

- A stack trace or `Error:` line near the top. That is almost
  always the real cause.
- `401 Unauthorized` from Telegram. Your `BOT_TOKEN` is wrong or
  was rotated. Fix it with `fly secrets set BOT_TOKEN=...`.
- `400 Bad Request: chat not found`. Your `CHANNEL_CHAT_ID` is
  wrong, or the bot is not in the channel, or it does not have
  admin rights. Re-check `.env.example` for the right format
  (numeric `-100...` id, NOT an invite link).
- `403 Forbidden: not enough rights to send text messages` or
  `not enough rights to delete messages`. The bot is in the
  channel but missing one of the two required admin permissions
  ("Post messages" AND "Delete messages"). Fix in the channel
  settings, no redeploy needed.
- Nothing at all. Try `fly machines restart -a zaaduna`. If it
  is still silent after a restart, check Fly's status page at
  https://status.flyio.net/.

### 3. Did a recent deploy break things?

If the bot was fine until your last `fly deploy`, roll back. See
the next section.

## Rolling back a bad deploy

You shipped something, the bot started crash-looping, and you do
not have time to debug right now. Roll back to the previous
working version.

### Step 1: find the last good version

```bash
fly releases -a zaaduna
```

You will see a table like:

```
VERSION  STATUS    DESCRIPTION    USER         DATE
v8       failed    Deploy image   you@...      30s ago
v7       complete  Deploy image   you@...      2h ago     <- last good one
v6       complete  Deploy image   you@...      1d ago
```

The one you want is the latest `complete` BEFORE the broken one
(`v7` in the example).

### Step 2: roll back to that version

```bash
fly releases rollback v7 -a zaaduna
```

Fly pulls the old Docker image and redeploys it. The bot should be
back online within a minute.

```bash
fly status -a zaaduna
fly logs   -a zaaduna
```

### Step 3: fix the bug at your own pace

A rollback only changes what is running on Fly. Your git history is
untouched, and the broken commit is still on `main`. Fix it locally,
run `pnpm test` and `pnpm typecheck`, then `fly deploy` again.

## Common errors seen the first time you deploy

These all surfaced during the initial Fly rollout. Listed here so
the next person does not have to re-discover them.

1. **`ERR_PNPM_IGNORED_BUILDS: Ignored build scripts: esbuild`** —
   pnpm 11 refuses to run unapproved dep install-scripts. Fix:
   `pnpm install --frozen-lockfile --ignore-scripts` in both
   Dockerfile stages (already done). We don't need any dep
   lifecycle script — tsc / tsx work from the prebuilt JS that
   each package already ships.

2. **`/health` endpoint not reachable from the internet** —
   Expected. The `/health` server is internal only; there is no
   `[http_service]` block in `fly.toml` (see "No `[http_service]`"
   above). To hit it for debugging, shell in:

   ```bash
   fly ssh console -a zaaduna -C 'wget -qO- http://localhost:8080/health'
   ```

3. **`machine has reached its max restart count of 10` and the
   machine stays stopped after a successful re-deploy** — When a
   crashing build hits Fly's 10-restart cap, Fly marks the machine
   as failed. A later `fly deploy` with fixed code uploads the
   new image but does NOT auto-start a `failed` machine. Fix:
   `fly machine start <id> -a zaaduna` once. After it boots
   cleanly, future deploys update in place normally.

4. **"Proxy not finding machines to route requests" warning in the
   Fly dashboard** — EXPECTED and harmless. Fly creates a public
   hostname `https://zaaduna.fly.dev` for every app; since our
   `fly.toml` has no `[http_service]`, there is nothing to route
   HTTP traffic to. The bot itself is fine. Ignore.

5. **Duplicate posts in the channel after a deploy** — You probably
   have 2 machines running. Both connect to Telegram with the same
   token and both fire the same cron at the same time. Pin to 1:

   ```bash
   fly machine list -a zaaduna
   fly machine destroy <extra-id> -a zaaduna --force
   fly scale count 1 -a zaaduna
   ```

6. **Welcome message disappeared after a deploy** — The welcome is
   posted manually by `pnpm post-welcome` and is NOT tracked by the
   bot's auto-cleanup. It will only disappear if someone deletes it
   in the channel, not from a deploy. Re-post it with `pnpm
   post-welcome` from your laptop and re-pin it.

## Migrating off Fly.io

If you ever leave Fly for another container host:

1. **Delete `fly.toml`**. Nothing else references it.
2. **Keep `Dockerfile` and `.dockerignore`**. Both are portable.
3. **Set the same env vars** on the new host using whatever
   mechanism it uses (Railway dashboard, systemd `EnvironmentFile`,
   Docker `--env-file`, k8s `Secret`, etc.). The contract in
   `.env.example` is identical across hosts.
4. **Rewrite this file** (`FLYIO.md`) for the new host, or remove
   it if the new host has its own deploy doc.
5. **Update `docs/DEPLOY.md`** to point at the new host instead of
   Fly.io.

The bot itself does not care which host runs it. The only
Fly-specific knobs are in `fly.toml` and this file.
