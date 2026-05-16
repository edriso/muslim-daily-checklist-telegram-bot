import { createServer } from 'node:http';
import { logger } from './lib/logger';

const DEFAULT_PORT = 8080;

/**
 * Resolve the health-server port from a raw env value.
 *
 * Robust on purpose: `.env.example` ships `PORT=""`, and `??` would NOT
 * substitute an empty string, so the bot used to crash with
 * ERR_SOCKET_BAD_PORT. Blank, non-numeric, partly-numeric ("3000abc"),
 * or out-of-range values all fall back to the default. We require the
 * whole value to be digits rather than using parseInt, which would
 * silently accept "3000abc" as 3000. Valid range is 1..65535 (0 would
 * make Node pick a random port, useless for a fixed health probe).
 *
 * Exported for unit testing.
 */
export function resolvePort(raw: string | undefined): number {
  const trimmed = raw?.trim();
  if (!trimmed || !/^\d+$/.test(trimmed)) return DEFAULT_PORT;
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n < 1 || n > 65535) return DEFAULT_PORT;
  return n;
}

/**
 * Minimal /health endpoint for PaaS uptime checks. Returns 200 while the
 * process is alive. A bad port or a bind failure is logged but never
 * crashes the bot.
 */
export function startHealthServer(): void {
  const port = resolvePort(process.env.PORT);

  const server = createServer((req, res) => {
    if (req.method !== 'GET' || req.url !== '/health') {
      res.statusCode = 404;
      res.end('Not found');
      return;
    }
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 200;
    res.end(
      JSON.stringify({
        status: 'ok',
        uptimeSeconds: Math.round(process.uptime()),
      }),
    );
  });

  server.on('error', (err) => {
    logger.warn('Health server failed to bind, continuing without it', {
      port,
      error: String(err),
    });
  });

  try {
    server.listen(port, () => {
      logger.info('Health server listening', { port });
    });
  } catch (err) {
    // Belt-and-suspenders: the bot must keep running even if the health
    // server cannot start. The docstring promises this.
    logger.warn('Health server could not start, continuing without it', {
      port,
      error: String(err),
    });
  }
}
