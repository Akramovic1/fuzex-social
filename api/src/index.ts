import { serve, type ServerType } from '@hono/node-server';

import { PdsAdminClient } from '@/modules/api-social/lib/pdsAdminClient.js';
import {
  CreateAccountService,
  FirestoreUserService,
  GetSessionService,
} from '@/modules/api-social/services/index.js';
import { config } from '@/shared/config/index.js';
import { closeDb, getDb } from '@/shared/db/index.js';
import { AuditLogsRepository, UsersRepository } from '@/shared/db/repositories/index.js';
import { logger } from '@/shared/logger/index.js';

import { buildApp } from './app.js';

const SHUTDOWN_TIMEOUT_MS = 10_000;

function startServer(): ServerType {
  const db = getDb();

  const usersRepo = new UsersRepository(db);
  const auditRepo = new AuditLogsRepository(db);
  const pdsClient = new PdsAdminClient();
  const firestoreUserService = new FirestoreUserService();
  const createAccountService = new CreateAccountService(
    firestoreUserService,
    pdsClient,
    usersRepo,
    auditRepo,
  );
  const getSessionService = new GetSessionService(usersRepo, pdsClient);

  const app = buildApp({ db, createAccountService, getSessionService });

  const server = serve(
    {
      fetch: app.fetch,
      port: config.env.PORT,
    },
    (info) => {
      logger.info(
        {
          port: info.port,
          env: config.env.NODE_ENV,
        },
        'fuzex-api listening',
      );
    },
  );

  return server;
}

function attachShutdownHandlers(server: ServerType): void {
  const shutdown = (signal: string): void => {
    logger.info({ signal }, 'shutdown signal received');

    const timer = setTimeout(() => {
      logger.error('forced shutdown — close timeout exceeded');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    timer.unref();

    server.close((err) => {
      if (err !== null && err !== undefined) {
        logger.error({ err }, 'error during shutdown');
        process.exit(1);
      }
      void closeDb()
        .catch((closeErr: unknown) => {
          logger.error({ err: closeErr }, 'error closing db pool');
        })
        .finally(() => {
          logger.info('graceful shutdown complete');
          process.exit(0);
        });
    });
  };

  process.on('SIGINT', () => {
    shutdown('SIGINT');
  });
  process.on('SIGTERM', () => {
    shutdown('SIGTERM');
  });

  process.on('unhandledRejection', (reason) => {
    logger.fatal({ err: reason }, 'unhandledRejection');
    process.exit(1);
  });

  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'uncaughtException');
    process.exit(1);
  });
}

const server = startServer();
attachShutdownHandlers(server);
