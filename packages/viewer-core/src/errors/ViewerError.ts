export interface ViewerError extends Error {
  code: ViewerErrorCode;
  format?: string;
  recoverable: boolean;
}

export type ViewerErrorCode =
  | 'UNSUPPORTED_FORMAT'
  | 'NO_ADAPTER_REGISTERED'
  | 'NO_MOUNT_ELEMENT'
  | 'LOAD_FAILED'
  | 'DECODE_ERROR'
  | 'SECURITY_ERROR'
  | 'RESOURCE_EXHAUSTED'
  | 'PASSWORD_REQUIRED'
  | 'CANCELLED'
  | 'WORKER_TERMINATED'
  | 'TIMEOUT';

export function createError(
  code: ViewerErrorCode,
  message: string,
  opts?: { format?: string; recoverable?: boolean },
): ViewerError {
  const error = Object.assign(new Error(message), {
    code,
    format: opts?.format,
    recoverable: opts?.recoverable ?? isRecoverable(code),
  }) as ViewerError;
  return error;
}

function isRecoverable(code: ViewerErrorCode): boolean {
  switch (code) {
    case 'LOAD_FAILED':
    case 'PASSWORD_REQUIRED':
    case 'CANCELLED':
    case 'TIMEOUT':
      return true;
    default:
      return false;
  }
}
