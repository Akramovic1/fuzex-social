import { HTTP_STATUS, type HttpStatusCode } from '@/shared/constants/httpStatus.js';

interface ErrorResponseBody {
  error: {
    code: string;
    message: string;
    details?: Readonly<Record<string, unknown>>;
  };
}

/**
 * Base class for all application errors.
 * Exposes a stable error code, HTTP status, and optional structured details.
 */
export abstract class AppError extends Error {
  public abstract readonly code: string;
  public abstract readonly statusCode: HttpStatusCode;
  public readonly details?: Readonly<Record<string, unknown>>;

  protected constructor(message: string, details?: Readonly<Record<string, unknown>>) {
    super(message);
    this.name = this.constructor.name;
    this.details = details;
    Error.captureStackTrace?.(this, this.constructor);
  }

  /**
   * Serializes this error to the standard API error response shape.
   *
   * @returns The response body with error code, message, and optional details.
   */
  public toResponseBody(): ErrorResponseBody {
    const body: ErrorResponseBody = {
      error: {
        code: this.code,
        message: this.message,
      },
    };
    if (this.details !== undefined) {
      body.error.details = this.details;
    }
    return body;
  }
}

export { HTTP_STATUS, type HttpStatusCode };
