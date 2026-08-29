import { API_BASE_URL } from '@/lib/constants';
import { toSnakeCase, toCamelCase } from '@/lib/utils';

const TOKEN_KEY = 'cmf_access_token';
const REFRESH_TOKEN_KEY = 'cmf_refresh_token';

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined>;
}

export interface ParsedApiErrorDetails {
  message: string;
  reason?: string;
  errors?: Record<string, string[]>;
  validationErrors?: any[];
  serializerErrors?: any;
  requestPayload?: any;
  fileInfo?: any;
  selectedTemplate?: string;
  mappingResult?: any;
  stackTrace?: string;
}

function parseApiError(errorBody: unknown): ParsedApiErrorDetails {
  if (typeof errorBody === 'object' && errorBody !== null) {
    const body = errorBody as Record<string, unknown>;

    // FastAPI's detail field
    if (body.detail !== undefined) {
      if (typeof body.detail === 'string') {
        return { message: body.detail, reason: body.detail };
      }
      if (Array.isArray(body.detail)) {
        const msgs = body.detail.map((d: any) => (typeof d === 'string' ? d : d.msg || JSON.stringify(d))).join('; ');
        return { message: msgs, reason: msgs, validationErrors: body.detail };
      }
      if (typeof body.detail === 'object' && body.detail !== null) {
        const d = body.detail as Record<string, any>;
        return {
          message: d.message || d.reason || 'An unexpected error occurred',
          reason: d.reason || d.message,
          validationErrors: d.validation_errors || d.validationErrors,
          serializerErrors: d.serializer_errors || d.serializerErrors,
          requestPayload: d.request_payload || d.requestPayload,
          fileInfo: d.uploaded_file || d.file_info || d.fileInfo,
          selectedTemplate: d.selected_template || d.selectedTemplate,
          mappingResult: d.mapping_result || d.mappingResult,
          stackTrace: d.stack_trace || d.stackTrace,
        };
      }
    }

    if (typeof body.message === 'string' || typeof body.reason === 'string') {
      return {
        message: (body.message as string) || (body.reason as string) || 'An unexpected error occurred',
        reason: (body.reason as string) || (body.message as string),
        errors: body.errors as Record<string, string[]> | undefined,
        validationErrors: (body.validation_errors || body.validationErrors) as any[],
        serializerErrors: body.serializer_errors || body.serializerErrors,
        requestPayload: body.request_payload || body.requestPayload,
        fileInfo: body.uploaded_file || body.file_info || body.fileInfo,
        selectedTemplate: (body.selected_template || body.selectedTemplate) as string,
        mappingResult: body.mapping_result || body.mappingResult,
        stackTrace: (body.stack_trace || body.stackTrace) as string,
      };
    }

    if (typeof body.error === 'object' && body.error !== null) {
      const err = body.error as Record<string, unknown>;
      return {
        message: (err.message as string) || 'An unexpected error occurred',
        errors: err.details as Record<string, string[]> | undefined,
      };
    }
  }
  return { message: 'An unexpected error occurred' };
}

class ApiClient {
  private baseURL: string;
  private refreshPromise: Promise<boolean> | null = null;
  private isRefreshing = false;

  constructor(baseURL: string) {
    this.baseURL = baseURL.replace(/\/+$/, '');
  }

  private buildUrl(path: string): string {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${this.baseURL}${cleanPath}`;
  }

  private getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  private getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  }

  private async refreshTokens(): Promise<boolean> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) return false;

    this.isRefreshing = true;
    try {
      const response = await fetch(this.buildUrl('/auth/refresh'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toSnakeCase({ refreshToken })),
      });

      if (!response.ok) {
        this.isRefreshing = false;
        return false;
      }

      const data = toCamelCase<TokenData>(await response.json());
      localStorage.setItem(TOKEN_KEY, data.accessToken);
      localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
      this.isRefreshing = false;
      return true;
    } catch {
      this.isRefreshing = false;
      return false;
    }
  }

  private async ensureValidToken(): Promise<void> {
    // If another call is already refreshing, wait for it
    if (this.refreshPromise) {
      await this.refreshPromise;
    }
  }

  private async request<T>(url: string, options: RequestOptions = {}): Promise<T> {
    const { body, params, ...rest } = options;

    let fullUrl = this.buildUrl(url);

    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, String(value));
        }
      });
      const qs = searchParams.toString();
      if (qs) fullUrl += `?${qs}`;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(rest.headers as Record<string, string>),
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const config: RequestInit = {
      ...rest,
      headers,
    };

    if (body !== undefined) {
      config.body = JSON.stringify(toSnakeCase(body));
    }

    let response = await fetch(fullUrl, config);

    if (response.status === 401) {
      const hasRefreshToken = this.getRefreshToken();
      if (hasRefreshToken) {
        if (!this.refreshPromise) {
          this.refreshPromise = this.refreshTokens();
        }

        const refreshed = await this.refreshPromise;
        this.refreshPromise = null;

        if (refreshed) {
          const newToken = this.getToken();
          if (newToken) {
            headers['Authorization'] = `Bearer ${newToken}`;
            config.headers = headers;
            if (body !== undefined) {
              config.body = JSON.stringify(toSnakeCase(body));
            }
            response = await fetch(fullUrl, config);
          }
        } else {
          window.dispatchEvent(new CustomEvent('auth:logout'));
          throw new ApiError('Session expired. Please log in again.', 401);
        }
      } else if (!this.isRefreshing) {
        // No refresh token and not currently refreshing — session is gone
        window.dispatchEvent(new CustomEvent('auth:logout'));
        throw new ApiError('Session expired. Please log in again.', 401);
      }
    }

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      const parsed = parseApiError(errorBody);
      throw new ApiError(
        parsed.message || `Request failed with status ${response.status}`,
        response.status,
        parsed,
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }

    const json = await response.json();
    return toCamelCase<T>(json);
  }

  get<T>(url: string, options?: RequestOptions) {
    return this.request<T>(url, { ...options, method: 'GET' });
  }

  post<T>(url: string, body?: unknown, options?: RequestOptions) {
    return this.request<T>(url, { ...options, method: 'POST', body });
  }

  put<T>(url: string, body?: unknown, options?: RequestOptions) {
    return this.request<T>(url, { ...options, method: 'PUT', body });
  }

  patch<T>(url: string, body?: unknown, options?: RequestOptions) {
    return this.request<T>(url, { ...options, method: 'PATCH', body });
  }

  delete<T>(url: string, options?: RequestOptions) {
    return this.request<T>(url, { ...options, method: 'DELETE' });
  }

  async upload<T>(url: string, formData: FormData): Promise<T> {
    // Wait for any in-progress token refresh before starting
    await this.ensureValidToken();

    const makeHeaders = (): Record<string, string> => {
      const h: Record<string, string> = {};
      const t = this.getToken();
      if (t) {
        h['Authorization'] = `Bearer ${t}`;
      }
      return h;
    };

    // Clone FormData entries so we can rebuild it for retries
    // (File streams may be consumed after the first fetch)
    const entries: [string, FormDataEntryValue][] = [];
    formData.forEach((value, key) => {
      entries.push([key, value]);
    });

    const rebuildFormData = (): FormData => {
      const fd = new FormData();
      for (const [key, value] of entries) {
        fd.append(key, value);
      }
      return fd;
    };

    let response = await fetch(this.buildUrl(url), {
      method: 'POST',
      headers: makeHeaders(),
      body: formData,
    });

    if (response.status === 401) {
      const hasRefreshToken = this.getRefreshToken();
      if (hasRefreshToken) {
        if (!this.refreshPromise) {
          this.refreshPromise = this.refreshTokens();
        }
        const refreshed = await this.refreshPromise;
        this.refreshPromise = null;

        if (refreshed) {
          // Rebuild FormData for the retry to avoid consumed stream issues
          response = await fetch(this.buildUrl(url), {
            method: 'POST',
            headers: makeHeaders(),
            body: rebuildFormData(),
          });
        } else {
          window.dispatchEvent(new CustomEvent('auth:logout'));
          throw new ApiError('Session expired. Please log in again.', 401);
        }
      } else if (!this.isRefreshing) {
        window.dispatchEvent(new CustomEvent('auth:logout'));
        throw new ApiError('Session expired. Please log in again.', 401);
      }
    }

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      const parsed = parseApiError(errorBody);
      throw new ApiError(
        parsed.message || `Upload failed with status ${response.status}`,
        response.status,
        parsed,
      );
    }

    const json = await response.json();
    return toCamelCase<T>(json);
  }
}

interface TokenData {
  accessToken: string;
  refreshToken: string;
}

export class ApiError extends Error {
  statusCode: number;
  /** Legacy generic field errors map */
  errors?: Record<string, string[]>;
  /** Structured import-error details returned by the backend */
  details?: ParsedApiErrorDetails;

  constructor(message: string, statusCode: number, details?: ParsedApiErrorDetails) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.details = details;
    // back-compat: preserve .errors if present
    this.errors = details?.errors;
  }

  get reason(): string | undefined {
    return this.details?.reason;
  }

  get validationErrors(): any[] {
    return this.details?.validationErrors ?? [];
  }

  get serializerErrors(): any {
    return this.details?.serializerErrors;
  }

  get requestPayload(): any {
    return this.details?.requestPayload;
  }

  get fileInfo(): any {
    return this.details?.fileInfo;
  }

  get selectedTemplate(): string | undefined {
    return this.details?.selectedTemplate;
  }

  get mappingResult(): any {
    return this.details?.mappingResult;
  }

  get stackTrace(): string | undefined {
    return this.details?.stackTrace;
  }
}

export const api = new ApiClient(API_BASE_URL);
