import { HTTP_STATUS, type HttpStatusCode } from '@/shared/constants/httpStatus.js';

import { AppError } from './AppError.js';

export class InternalError extends AppError {
  public readonly code = 'INTERNAL_ERROR';
  public readonly statusCode: HttpStatusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR;

  public constructor(
    message = 'Internal server error',
    details?: Readonly<Record<string, unknown>>,
  ) {
    super(message, details);
  }
}
