import { HTTP_STATUS, type HttpStatusCode } from '@/shared/constants/httpStatus.js';

import { AppError } from './AppError.js';

export class ValidationError extends AppError {
  public readonly code = 'VALIDATION_ERROR';
  public readonly statusCode: HttpStatusCode = HTTP_STATUS.BAD_REQUEST;

  public constructor(message = 'Validation failed', details?: Readonly<Record<string, unknown>>) {
    super(message, details);
  }
}
