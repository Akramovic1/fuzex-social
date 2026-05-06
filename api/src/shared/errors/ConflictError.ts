import { HTTP_STATUS, type HttpStatusCode } from '@/shared/constants/httpStatus.js';

import { AppError } from './AppError.js';

export class ConflictError extends AppError {
  public readonly code = 'CONFLICT';
  public readonly statusCode: HttpStatusCode = HTTP_STATUS.CONFLICT;

  public constructor(message = 'Conflict', details?: Readonly<Record<string, unknown>>) {
    super(message, details);
  }
}
