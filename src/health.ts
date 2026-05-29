import { createServer } from 'node:http';
import { logger } from './lib/logger';

const DEFAULT_PORT = 8080;

/**
 * Resolve the health-server port from a raw env value, falling back to
 * the default for anything blank, non-numeric, or out of 1..65535. The
 * digits-only check (not parseInt) rejects "3000abc"; the blank check
 * matters because `.env.example` ships PORT="". Exported for tests.
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
    // The bot must keep running even if the health server can't start.
    logger.warn('Health server could not start, continuing without it', {
      port,
      error: String(err),
    });
  }
}
