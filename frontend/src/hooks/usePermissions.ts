import { useAuthStore } from '@/stores/authStore';
import { UserRole } from '@/types';
import { ShoppingBag, Gauge, ShieldCheck, Crown, Eye } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface RoleMeta {
  role: UserRole;
  title: string;
  shortTitle: string;
  description: string;
  badgeClass: string;
  icon: LucideIcon;
}

export const ROLE_METADATA: Record<UserRole, RoleMeta> = {
  [UserRole.ADMIN]: {
    role: UserRole.ADMIN,
    title: 'Administrator',
    shortTitle: 'Admin',
    description: 'Full system access and user management',
    badgeClass: 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800',
    icon: Crown,
  },
  [UserRole.BUYER]: {
    role: UserRole.BUYER,
    title: 'Buyer (Acheteur)',
    shortTitle: 'Buyer',
    description: 'Procurement, sourcing, supplier & project management',
    badgeClass: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    icon: ShoppingBag,
  },
  [UserRole.CAPACITY_MANAGER]: {
    role: UserRole.CAPACITY_MANAGER,
    title: 'Capacity Manager (Resp. Capacité)',
    shortTitle: 'Capacity Mgr',
    description: 'Industrial line load, capacity assessments & bottleneck analysis',
    badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    icon: Gauge,
  },
  [UserRole.SQD]: {
    role: UserRole.SQD,
    title: 'SQD (Supplier Quality Development)',
    shortTitle: 'SQD Quality',
    description: 'Supplier quality control, defect tracking & risk mitigation',
    badgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    icon: ShieldCheck,
  },
  [UserRole.VIEWER]: {
    role: UserRole.VIEWER,
    title: 'Viewer',
    shortTitle: 'Viewer',
    description: 'Read-only platform inspection',
    badgeClass: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700',
    icon: Eye,
  },
};

export function usePermissions() {
  const { state } = useAuthStore();
  const role = (state.user?.role as UserRole) || UserRole.VIEWER;
  const meta = ROLE_METADATA[role] || ROLE_METADATA[UserRole.VIEWER];

  const isAdmin = role === UserRole.ADMIN;
  const isBuyer = role === UserRole.BUYER;
  const isCapacityManager = role === UserRole.CAPACITY_MANAGER;
  const isSQD = role === UserRole.SQD;

  return {
    role,
    roleMeta: meta,
    isAdmin,
    isBuyer,
    isCapacityManager,
    isSQD,

    // Capabilities matrix
    canManageProjects: isAdmin || isBuyer || isCapacityManager,
    canManageParts: isAdmin || isBuyer || isCapacityManager,
    canManageSuppliers: isAdmin || isBuyer,
    canCreateCapacityAssessment: isAdmin || isCapacityManager,
    canApproveCapacity: isAdmin || isCapacityManager,
    canManageRisks: isAdmin || isSQD || isBuyer || isCapacityManager,
    canManageQualityDocuments: isAdmin || isSQD || isBuyer || isCapacityManager,
    canAccessAdminPanel: isAdmin,
  };
}
