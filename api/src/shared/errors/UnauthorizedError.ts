import { HTTP_STATUS, type HttpStatusCode } from '@/shared/constants/httpStatus.js';

import { AppError } from './AppError.js';

export class UnauthorizedError extends AppError {
  public readonly code = 'UNAUTHORIZED';
  public readonly statusCode: HttpStatusCode = HTTP_STATUS.UNAUTHORIZED;

  public constructor(
    message = 'Authentication required',
    details?: Readonly<Record<string, unknown>>,
  ) {
    super(message, details);
  }
}
