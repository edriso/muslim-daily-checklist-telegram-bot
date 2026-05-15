import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    pool: 'threads',
    // config.ts throws at import time if these are missing. Tests that
    // import the scheduler/post layer transitively load config, so give
    // them harmless dummies. dotenv does not override already-set vars,
    // so a real local .env never leaks into tests.
    env: {
      BOT_TOKEN: 'test-bot-token',
      CHANNEL_CHAT_ID: '@test_channel',
      TZ_NAME: 'Africa/Cairo',
    },
  },
});
