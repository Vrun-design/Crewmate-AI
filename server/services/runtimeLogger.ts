import { redactSensitiveValue } from './redaction';
import { getRequestId } from './requestContext';

interface ErrorResponseOptions {
  code?: string;
  retryable?: boolean;
  status?: number;
}

export interface ErrorResponsePayload {
  message: string;
  code?: string;
  retryable?: boolean;
}

export function logServerError(scope: string, error: unknown, context?: Record<string, unknown>): void {
  const payload = {
    scope,
    requestId: getRequestId(),
    context: redactSensitiveValue(context),
    error: error instanceof Error
      ? {
          message: error.message,
          stack: error.stack,
        }
      : redactSensitiveValue(String(error), 'error'),
  };

  console.error(JSON.stringify(payload));
}

export function createErrorResponse(
  message: string,
  options: ErrorResponseOptions = {},
): { status: number; body: ErrorResponsePayload } {
  return {
    status: options.status ?? 500,
    body: {
      message,
      ...(options.code ? { code: options.code } : {}),
      ...(options.retryable !== undefined ? { retryable: options.retryable } : {}),
    },
  };
}
