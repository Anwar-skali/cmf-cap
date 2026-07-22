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

export function toSnakeCase<T>(obj: unknown): T {
  if (Array.isArray(obj)) {
    return obj.map((item) => toSnakeCase(item)) as T;
  }
  if (isObject(obj)) {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[camelToSnake(key)] = toSnakeCase(value);
    }
    return result as T;
  }
  return obj as T;
}

export function toCamelCase<T>(obj: unknown): T {
  if (Array.isArray(obj)) {
    return obj.map((item) => toCamelCase(item)) as T;
  }
  if (isObject(obj)) {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[snakeToCamel(key)] = toCamelCase(value);
    }
    return result as T;
  }
  return obj as T;
}
