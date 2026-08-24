/// <reference types="vite/client" />

export const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

export const APP_NAME = import.meta.env.VITE_APP_NAME || 'CMF Platform';

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_PAGE_SIZE: 10,
  PAGE_SIZE_OPTIONS: [10, 20, 30, 50, 100] as const,
} as const;

export const ROLES = {
  ADMIN: 'admin',
  CAPACITY_MANAGER: 'capacity_manager',
  BUYER: 'buyer',
  SQD: 'sqd',
  VIEWER: 'viewer',
} as const;

export const PROJECT_STATUSES = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  ON_HOLD: 'on_hold',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;

export const PART_STATUSES = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  OBSOLETE: 'obsolete',
} as const;

export const SUPPLIER_STATUSES = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  BLACKLISTED: 'blacklisted',
} as const;

export const CAPACITY_STATUSES = {
  PENDING: 'pending',
  ASSESSED: 'assessed',
  CONFIRMED: 'confirmed',
  REJECTED: 'rejected',
} as const;

export const RISK_SEVERITIES = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
} as const;

export const RISK_PROBABILITIES = {
  RARE: 'rare',
  UNLIKELY: 'unlikely',
  POSSIBLE: 'possible',
  LIKELY: 'likely',
  ALMOST_CERTAIN: 'almost_certain',
} as const;

export const RISK_STATUSES = {
  OPEN: 'open',
  MITIGATING: 'mitigating',
  MITIGATED: 'mitigated',
  CLOSED: 'closed',
} as const;

export const DOCUMENT_TYPES = {
  CONTRACT: 'contract',
  SPECIFICATION: 'specification',
  DRAWING: 'drawing',
  REPORT: 'report',
  CERTIFICATE: 'certificate',
  OTHER: 'other',
} as const;

export const NOTIFICATION_TYPES = {
  INFO: 'info',
  SUCCESS: 'success',
  WARNING: 'warning',
  ERROR: 'error',
} as const;

export const ACTIVITY_ACTIONS = {
  CREATED: 'created',
  UPDATED: 'updated',
  DELETED: 'deleted',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  SUBMITTED: 'submitted',
  REVIEWED: 'reviewed',
  ASSIGNED: 'assigned',
  STATUS_CHANGED: 'status_changed',
} as const;

export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    REFRESH: '/auth/refresh',
    LOGOUT: '/auth/logout',
    CHANGE_PASSWORD: '/auth/change-password',
    FORGOT_PASSWORD: '/auth/forgot-password',
    RESET_PASSWORD: '/auth/reset-password',
    ME: '/auth/me',
  },
  PROJECTS: {
    BASE: '/projects',
    BY_ID: (id: string) => `/projects/${id}`,
    STATUS: (id: string) => `/projects/${id}/status`,
    BULK_DELETE: '/projects/bulk-delete',
  },
  PARTS: {
    BASE: '/parts',
    BY_ID: (id: string) => `/parts/${id}`,
    BY_PROJECT: (projectId: string) => `/projects/${projectId}/parts`,
    BY_PROJECT_AND_ID: (projectId: string, id: string) => `/projects/${projectId}/parts/${id}`,
  },
  SUPPLIERS: {
    BASE: '/suppliers',
    BY_ID: (id: string) => `/suppliers/${id}`,
    ASSIGN: (id: string, projectId: string) => `/suppliers/${id}/assign/${projectId}`,
    REMOVE: (id: string, projectId: string) => `/suppliers/${id}/assign/${projectId}`,
  },
  CAPACITY: {
    BASE: '/capacity',
    BY_ID: (id: string) => `/capacity/${id}`,
    COVERAGE: '/capacity/coverage',
    MONTHLY: (year: number, month: number) => `/capacity/monthly/${year}/${month}`,
  },
  RISKS: {
    BASE: '/risks',
    BY_ID: (id: string) => `/risks/${id}`,
    MITIGATE: (id: string) => `/risks/${id}/mitigate`,
    CLOSE: (id: string) => `/risks/${id}/close`,
    DISTRIBUTION: '/risks/distribution',
  },
  DOCUMENTS: {
    BASE: '/documents',
    UPLOAD: '/documents/upload',
    BY_ID: (id: string) => `/documents/${id}`,
    DOWNLOAD: (id: string) => `/documents/${id}/download`,
  },
  NOTIFICATIONS: {
    BASE: '/notifications',
    UNREAD_COUNT: '/notifications/unread-count',
    MARK_READ: (id: string) => `/notifications/${id}/read`,
    MARK_ALL_READ: '/notifications/read-all',
    BY_ID: (id: string) => `/notifications/${id}`,
  },
  ACTIVITY: {
    BASE: '/activity',
    RECENT: '/activity/recent',
  },
  DASHBOARD: {
    STATS: '/dashboard/stats',
  },
} as const;
