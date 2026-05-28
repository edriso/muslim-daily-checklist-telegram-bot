# syntax=docker/dockerfile:1
#
# Multi-stage build for the Zaaduna Telegram bot.
# Builder installs every dep and compiles TS to JS; runtime is a slim
# image with only the compiled output and prod node_modules.
#
# Note: `tsx` stays in the runtime image because the start command is
# `node --import tsx dist/index.js` — tsx provides the ESM import hook
# that resolves the extension-less relative imports in dist/ (a
# consequence of tsconfig `moduleResolution: "bundler"` + ESM Node).

# ---------- builder ----------
FROM node:22-alpine AS builder
WORKDIR /app

RUN corepack enable

# --ignore-scripts skips every install-time script (e.g. esbuild's
# postinstall). pnpm 11 refuses to run unapproved scripts and exits
# non-zero with ERR_PNPM_IGNORED_BUILDS; --ignore-scripts sidesteps
# the gate without an allowlist. We don't need any dep lifecycle
# script — tsc/tsx run from the prebuilt JS bundled in each package.
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts

COPY tsconfig.json ./
COPY src ./src
RUN pnpm build

# ---------- runtime ----------
FROM node:22-alpine
WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml ./
# --prod drops devDependencies (typescript, vitest, prettier, @types/*)
# but keeps `tsx`, which is a regular dependency because the start
# command needs it.
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

COPY --from=builder /app/dist ./dist

# The bot writes a tiny JSON pointer file under ./data at runtime
# (see src/lib/state.ts). Pre-create the dir and hand it to the node
# user so the drop-privileges step below does not break writes.
RUN mkdir -p /app/data && chown -R node:node /app/data

# Drop privileges. The official node image ships a `node` user with
# UID 1000.
USER node

CMD ["node", "--import", "tsx", "dist/index.js"]
