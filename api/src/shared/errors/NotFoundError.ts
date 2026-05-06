import { HTTP_STATUS, type HttpStatusCode } from '@/shared/constants/httpStatus.js';

import { AppError } from './AppError.js';

export class NotFoundError extends AppError {
  public readonly code = 'NOT_FOUND';
  public readonly statusCode: HttpStatusCode = HTTP_STATUS.NOT_FOUND;

  public constructor(message = 'Resource not found', details?: Readonly<Record<string, unknown>>) {
    super(message, details);
  }
}
