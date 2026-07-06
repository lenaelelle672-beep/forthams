/**
 * @module frontend/src/app/services/approval/errors
 * @description Custom error classes for the Approval Service SDK.
 *
 * Provides structured error handling with machine-readable error codes:
 * - NETWORK_ERROR: request failed to reach the server (timeout, CORS, offline)
 * - VALIDATION_ERROR: client-side validation failure (e.g. missing comment on reject)
 * - SERVER_ERROR: server returned a non-2xx response
 */

/** Machine-readable error codes for the approval service. */
export type ApprovalErrorCode =
  | 'NETWORK_ERROR'
  | 'VALIDATION_ERROR'
  | 'SERVER_ERROR'
  | 'UNAUTHORIZED'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'UNKNOWN';

/**
 * Custom error class for approval service operations.
 *
 * Extends the native Error class with structured metadata:
 * - `code`: machine-readable error code for programmatic handling
 * - `status`: HTTP status code (when applicable)
 *
 * @example
 * ```ts
 * try {
 *   await approvalApi.approve(processId, { result: 'APPROVED', opinion: '' });
 * } catch (err) {
 *   if (err instanceof ApprovalServiceError && err.code === 'NETWORK_ERROR') {
 *     showToast('网络异常，请稍后重试');
 *   }
 * }
 * ```
 */
export class ApprovalServiceError extends Error {
  /** Machine-readable error code */
  public readonly code: ApprovalErrorCode;
  /** HTTP status code from the server response (0 if no response) */
  public readonly status: number;

  /**
   * Create an ApprovalServiceError.
   *
   * @param message - Human-readable error description
   * @param code    - Machine-readable error code
   * @param status  - HTTP status code (default 0)
   */
  constructor(message: string, code: ApprovalErrorCode = 'UNKNOWN', status: number = 0) {
    super(message);
    this.name = 'ApprovalServiceError';
    this.code = code;
    this.status = status;
  }
}

/**
 * Create a NETWORK_ERROR from a raw fetch/axios error.
 *
 * @param originalError - The original error thrown by the HTTP client
 * @returns An ApprovalServiceError with code NETWORK_ERROR
 */
export function createNetworkError(originalError: unknown): ApprovalServiceError {
  const message =
    originalError instanceof Error
      ? originalError.message
      : '网络异常，请稍后重试';
  return new ApprovalServiceError(message, 'NETWORK_ERROR', 0);
}

/**
 * Create a VALIDATION_ERROR for client-side validation failures.
 *
 * @param message - Description of the validation failure
 * @returns An ApprovalServiceError with code VALIDATION_ERROR
 */
export function createValidationError(message: string): ApprovalServiceError {
  return new ApprovalServiceError(message, 'VALIDATION_ERROR', 400);
}

/**
 * Create a SERVER_ERROR from an HTTP response.
 *
 * @param status  - HTTP status code
 * @param message - Error message from the response body or default
 * @returns An ApprovalServiceError with the appropriate code
 */
export function createServerError(status: number, message: string): ApprovalServiceError {
  let code: ApprovalErrorCode = 'SERVER_ERROR';

  if (status === 401) {
    code = 'UNAUTHORIZED';
  } else if (status === 404) {
    code = 'NOT_FOUND';
  } else if (status === 409) {
    code = 'CONFLICT';
  }

  return new ApprovalServiceError(message, code, status);
}
