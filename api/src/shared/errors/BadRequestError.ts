import { HTTP_STATUS, type HttpStatusCode } from '@/shared/constants/httpStatus.js';

import { AppError } from './AppError.js';

export class BadRequestError extends AppError {
  public readonly code = 'BAD_REQUEST';
  public readonly statusCode: HttpStatusCode = HTTP_STATUS.BAD_REQUEST;

  public constructor(message = 'Bad request', details?: Readonly<Record<string, unknown>>) {
    super(message, details);
  }
}
