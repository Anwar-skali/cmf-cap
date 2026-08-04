import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const statusVariantMap: Record<string, 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning'> = {
  draft: 'secondary',
  active: 'default',
  on_hold: 'warning',
  completed: 'success',
  cancelled: 'destructive',
  inactive: 'secondary',
  obsolete: 'secondary',
  pending: 'warning',
  assessed: 'default',
  confirmed: 'success',
  rejected: 'destructive',
  open: 'destructive',
  mitigating: 'warning',
  mitigated: 'success',
  closed: 'secondary',
  blacklisted: 'destructive',
};

export function getStatusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' {
  return statusVariantMap[status] ?? 'default';
}

const riskLevelVariantMap: Record<string, 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning'> = {
  critical: 'destructive',
  high: 'warning',
  medium: 'default',
  low: 'secondary',
};

export function getRiskLevelVariant(level: string): 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' {
  return riskLevelVariantMap[level] ?? 'default';
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function camelToSnake(key: string): string {
  return key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function snakeToCamel(key: string): string {
  return key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

export function toSnakeCase<T>(obj: unknown, _depth = 0, _parentKey = ''): T {
  if (Array.isArray(obj)) {
    return obj.map((item) => toSnakeCase(item, _depth + 1, _parentKey)) as T;
  }
  if (isObject(obj)) {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      const snakeKey = camelToSnake(key);
      // 'data' is a dynamic domain blob — preserve its inner keys as-is
      if (snakeKey === 'data' && isObject(value)) {
        result[snakeKey] = value;
      } else {
        result[snakeKey] = toSnakeCase(value, _depth + 1, snakeKey);
      }
    }
    return result as T;
  }
  return obj as T;
}

export function toCamelCase<T>(obj: unknown, _depth = 0, _parentKey = ''): T {
  if (Array.isArray(obj)) {
    return obj.map((item) => toCamelCase(item, _depth + 1, _parentKey)) as T;
  }
  if (isObject(obj)) {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      const camelKey = snakeToCamel(key);
      // 'data', 'mapping', and 'columnMapping' are domain blobs keyed by
      // arbitrary snake_case field identifiers — preserve their inner keys as-is
      if ((camelKey === 'data' || camelKey === 'mapping' || camelKey === 'columnMapping') && isObject(value)) {
        result[camelKey] = value;
      } else {
        result[camelKey] = toCamelCase(value, _depth + 1, camelKey);
      }
    }
    return result as T;
  }
  return obj as T;
}
