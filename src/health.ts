import { createServer } from 'node:http';
import { logger } from './lib/logger';

/**
 * Minimal /health endpoint for PaaS uptime checks. Returns 200 while the
 * process is alive. Bind failures are logged but never crash the bot.
 */
export function startHealthServer(): void {
  const port = parseInt(process.env.PORT ?? '8080', 10);

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

  server.listen(port, () => {
    logger.info('Health server listening', { port });
  });
}
