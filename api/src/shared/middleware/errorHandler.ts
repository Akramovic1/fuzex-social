import { type Context, type Hono } from 'hono';
import { type ContentfulStatusCode } from 'hono/utils/http-status';

import { HTTP_STATUS } from '@/shared/constants/httpStatus.js';
import { AppError, InternalError } from '@/shared/errors/index.js';
import { logger } from '@/shared/logger/index.js';

interface ErrorResponseBody {
  error: {
    code: string;
    message: string;
    details?: Readonly<Record<string, unknown>>;
  };
}

function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

function buildErrorResponse(c: Context, error: AppError): Response {
  const body: ErrorResponseBody = error.toResponseBody();
  return c.json(body, error.statusCode as ContentfulStatusCode);
}

function buildUnknownErrorResponse(c: Context): Response {
  const body: ErrorResponseBody = new InternalError().toResponseBody();
  return c.json(body, HTTP_STATUS.INTERNAL_SERVER_ERROR);
}

/**
 * Registers the global error handler on a Hono app.
 *
 * - AppError instances → typed response with their statusCode/code/message.
 * - All other errors → InternalError, logged at error level.
 *
 * @param app - The Hono app to register the handler on.
 */
export function registerErrorHandler(app: Hono): void {
  app.onError((error, c) => {
    const correlationId = c.get('correlationId');

    if (isAppError(error)) {
      logger.warn(
        {
          correlationId,
          code: error.code,
          statusCode: error.statusCode,
          path: c.req.path,
          method: c.req.method,
          err: error,
        },
        'handled application error',
      );
      return buildErrorResponse(c, error);
    }

    logger.error(
      {
        correlationId,
        path: c.req.path,
        method: c.req.method,
        err: error,
      },
      'unhandled error',
    );
    return buildUnknownErrorResponse(c);
  });
}
