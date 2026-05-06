import { HTTP_STATUS, type HttpStatusCode } from '@/shared/constants/httpStatus.js';

import { AppError } from './AppError.js';

export class HandleResolutionError extends AppError {
  public readonly code: string;
  public readonly statusCode: HttpStatusCode;

  /**
   * Thrown when a handle cannot be resolved (not found, malformed, tipping disabled, etc.).
   *
   * @param code - Specific error code (e.g., 'USER_NOT_FOUND', 'INVALID_HANDLE', 'TIPPING_DISABLED').
   * @param statusCode - HTTP status to return.
   * @param message - Human-readable message.
   * @param details - Optional structured details.
   */
  public constructor(
    code: string,
    statusCode: HttpStatusCode,
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ) {
    super(message, details);
    this.code = code;
    this.statusCode = statusCode;
  }

  public static notFound(handle: string): HandleResolutionError {
    return new HandleResolutionError(
      'USER_NOT_FOUND',
      HTTP_STATUS.NOT_FOUND,
      `No user found for handle "${handle}"`,
      { handle },
    );
  }

  public static invalidHandle(reason: string): HandleResolutionError {
    return new HandleResolutionError(
      'INVALID_HANDLE',
      HTTP_STATUS.BAD_REQUEST,
      `Invalid handle: ${reason}`,
      { reason },
    );
  }

  public static tippingDisabled(handle: string): HandleResolutionError {
    return new HandleResolutionError(
      'TIPPING_DISABLED',
      HTTP_STATUS.NOT_FOUND,
      `Tipping is not enabled for "${handle}"`,
      { handle },
    );
  }
}
