import { ApiError } from '@/api/client';

export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.errors) {
      const fieldMessages = Object.values(error.errors).flat();
      if (fieldMessages.length > 0) return fieldMessages.join('; ');
    }
    return error.message;
  }
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'An unexpected error occurred';
}

export function getFieldErrors(error: unknown): Record<string, string[]> | undefined {
  if (error instanceof ApiError) return error.errors;
  return undefined;
}

export function useApiError() {
  function handleError(error: unknown): void {
    console.error('[API Error]', error);
  }

  return { handleError, getErrorMessage, getFieldErrors };
}
