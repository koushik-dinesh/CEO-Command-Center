import { env } from './config/env.js';
import { createApp } from './app.js';
import { closePool } from './db/mysql.js';
import { scheduleSnapshotDiscovery } from './jobs/scheduleSnapshotDiscovery.js';
import { scheduleIngestionJob } from './jobs/scheduleIngestionJob.js';
import { logger } from './utils/logger.js';

const app = createApp();
const server = app.listen(env.PORT, () => {
  logger.info('server started', {
    operation: 'startup',
    port: env.PORT,
    nodeEnv: env.NODE_ENV,
    clientOrigin: env.CLIENT_ORIGIN,
  });

  if (env.NODE_ENV === 'production' && env.DB_PASSWORD === 'ceo_password') {
    logger.warn('using default DB_PASSWORD in production — change this for security', {
      operation: 'startup',
    });
  }
  scheduleSnapshotDiscovery();
  scheduleIngestionJob();
});

let shuttingDown = false;

async function shutdown(signal: string, exitCode = 0): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info('shutdown initiated', { operation: 'shutdown', signal });

  server.close(async (closeError) => {
    if (closeError) {
      logger.error('http server close failed', {
        operation: 'shutdown',
        signal,
        stack: closeError.stack,
      });
      exitCode = 1;
    }

    try {
      await closePool();
      logger.info('shutdown complete', { operation: 'shutdown', signal });
    } catch (error) {
      logger.error('database pool close failed', {
        operation: 'shutdown',
        signal,
        stack: error instanceof Error ? error.stack : undefined,
      });
      exitCode = 1;
    }

    process.exit(exitCode);
  });

  setTimeout(() => {
    logger.error('forced shutdown after timeout', { operation: 'shutdown', signal });
    process.exit(1);
  }, 15_000).unref();
}

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

process.on('unhandledRejection', (reason) => {
  logger.error('unhandled rejection', {
    operation: 'process.unhandledRejection',
    stack: reason instanceof Error ? reason.stack : undefined,
    reason: reason instanceof Error ? reason.message : String(reason),
  });
});

process.on('uncaughtException', (error) => {
  logger.error('uncaught exception', {
    operation: 'process.uncaughtException',
    stack: error.stack,
    message: error.message,
  });
  void shutdown('uncaughtException', 1);
});
