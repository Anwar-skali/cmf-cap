/**
 * useCmfDashboardData
 *
 * Centralised data layer for the CMF Dashboard.
 *
 * ─── LIVE DATA ──────────────────────────────────────────────────────────────
 *   Derived from existing API queries already in the project:
 *     • totalProjects       ← stats.totalProjects  || projectsList.length
 *     • activeProjects      ← stats.activeProjects
 *     • totalSuppliers      ← stats.totalSuppliers  (active filter: status=active)
 *     • openRisks           ← stats.openRisks
 *     • criticalRisks       ← stats.criticalRisks
 *
 * ─── MOCK DATA ─────────────────────────────────────────────────────────────
 *   Values marked /** MOCK **\/ below are realistic demo values.
 *   Replace each with the corresponding real API call when the endpoint exists.
 *
 *     • totalCapacity       → GET /api/v1/capacity/summary → summary.totalCapacity
 *     • allocatedCapacity   → GET /api/v1/capacity/summary → summary.allocatedCapacity
 *     • usedCapacity        → GET /api/v1/capacity/summary → summary.usedCapacity
 *     • remainingCapacity   → computed from summary
 *     • utilizationPct      → GET /api/v1/capacity/summary → summary.utilizationPct
 *     • projectsOnTrack     → GET /api/v1/projects?status=on_track → total
 *     • projectsAtRisk      → GET /api/v1/projects?status=at_risk → total
 *     • projectsDelayed     → GET /api/v1/projects?status=delayed → total
 *     • projectsCompleted   → GET /api/v1/projects?status=completed → total
 *     • openQualityIssues   → GET /api/v1/risks?category=quality → total
 *     • criticalQualityIssues → GET /api/v1/risks?severity=critical&category=quality → total
 *     • openActions         → GET /api/v1/risks?status=open → total
 *     • supplierQualityStatus → GET /api/v1/suppliers/quality-summary
 *     • projectsByCustomer  → GET /api/v1/projects/by-customer
 *     • upcomingMilestones  → GET /api/v1/projects/milestones?upcoming=true
 */

import { useDashboardStatsQuery } from '@/hooks/queries/useDashboardQuery';
import { useProjectsQuery } from '@/hooks/queries/useProjectsQuery';

// ─── MOCK CONSTANTS (replace with real API calls) ────────────────────────────
/** MOCK */ const MOCK_TOTAL_CAPACITY = 48_500;       // units (e.g., pcs/week)
/** MOCK */ const MOCK_ALLOCATED_CAPACITY = 41_200;
/** MOCK */ const MOCK_USED_CAPACITY = 38_900;
/** MOCK */ const MOCK_PROJECTS_ON_TRACK = 38;
/** MOCK */ const MOCK_PROJECTS_AT_RISK = 9;
/** MOCK */ const MOCK_PROJECTS_DELAYED = 5;
/** MOCK */ const MOCK_PROJECTS_COMPLETED = 22;
/** MOCK */ const MOCK_OPEN_QUALITY_ISSUES = 14;
/** MOCK */ const MOCK_CRITICAL_QUALITY_ISSUES = 3;
/** MOCK */ const MOCK_OPEN_ACTIONS = 27;
/** MOCK */ const MOCK_SUPPLIER_QUALITY_STATUS = 'GREEN';   // GREEN | YELLOW | RED
/** MOCK */ const MOCK_PROJECTS_BY_CUSTOMER: Array<{ customer: string; count: number }> = [
  { customer: 'Stellantis', count: 31 },
  { customer: 'Renault Group', count: 18 },
  { customer: 'Volkswagen', count: 14 },
  { customer: 'BMW Group', count: 9 },
  { customer: 'Others', count: 9 },
];
/** MOCK */ const MOCK_UPCOMING_MILESTONES = 7;

// ─── MOCK CHART DATA (replace with real API calls) ───────────────────────────

/** MOCK — replace with GET /api/v1/capacity/monthly */
export const MOCK_CAPACITY_TREND: Array<{ month: string; available: number; allocated: number; used: number }> = [
  { month: 'Mar', available: 48_500, allocated: 38_000, used: 35_200 },
  { month: 'Apr', available: 48_500, allocated: 39_500, used: 37_100 },
  { month: 'May', available: 48_500, allocated: 40_100, used: 38_000 },
  { month: 'Jun', available: 48_500, allocated: 41_800, used: 39_500 },
  { month: 'Jul', available: 48_500, allocated: 40_600, used: 38_400 },
  { month: 'Aug', available: 48_500, allocated: 41_200, used: 38_900 },
];

/** MOCK — replace with GET /api/v1/risks/distribution?category=quality */
export const MOCK_SQD_PIE: Array<{ name: string; value: number }> = [
  { name: 'Open', value: 14 },
  { name: 'Critical', value: 3 },
  { name: 'Closed', value: 41 },
  { name: 'In Progress', value: 9 },
];

/** MOCK — replace with GET /api/v1/projects/status-summary */
export const MOCK_PROJECT_STATUS_BAR: Array<{ name: string; count: number }> = [
  { name: 'Active', count: 74 },
  { name: 'On Track', count: 38 },
  { name: 'At Risk', count: 9 },
  { name: 'Delayed', count: 5 },
  { name: 'Completed', count: 22 },
];
// ─────────────────────────────────────────────────────────────────────────────

export interface CmfDashboardData {
  // ── KPIs ──────────────────────────────────────────────────────────────────
  totalProjects: number;
  totalCapacity: number;
  utilizationPct: number;
  capacityGap: number;
  activeSuppliers: number;
  projectsAtRisk: number;

  // ── Capacity Overview ─────────────────────────────────────────────────────
  availableCapacity: number;
  allocatedCapacity: number;
  usedCapacity: number;
  remainingCapacity: number;

  // ── Project Status ────────────────────────────────────────────────────────
  activeProjects: number;
  projectsOnTrack: number;
  projectsDelayed: number;
  projectsCompleted: number;

  // ── SQD Overview ─────────────────────────────────────────────────────────
  openQualityIssues: number;
  criticalQualityIssues: number;
  openActions: number;
  supplierQualityStatus: string;

  // ── Buyer / Project Overview ──────────────────────────────────────────────
  projectsByCustomer: Array<{ customer: string; count: number }>;
  upcomingMilestones: number;

  // ── Loading state ─────────────────────────────────────────────────────────
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useCmfDashboardData(): CmfDashboardData {
  const { data: stats, isLoading, error, refetch } = useDashboardStatsQuery();
  const { data: projectsData } = useProjectsQuery();

  const rawProjects = projectsData?.items ?? [];
  const totalProjects = stats?.totalProjects ?? rawProjects.length ?? 74;
  const activeProjects = stats?.activeProjects ?? 74;
  const activeSuppliers = stats?.activeSuppliers ?? stats?.totalSuppliers ?? 32;

  // Capacity — computed from mock constants (replace with real API)
  const totalCapacity = MOCK_TOTAL_CAPACITY;
  const allocatedCapacity = MOCK_ALLOCATED_CAPACITY;
  const usedCapacity = MOCK_USED_CAPACITY;
  const remainingCapacity = totalCapacity - usedCapacity;
  const utilizationPct = Math.round((usedCapacity / totalCapacity) * 100);
  const capacityGap = allocatedCapacity - usedCapacity;

  // Risks — use live openRisks from stats where available
  const projectsAtRisk = stats?.openRisks ?? MOCK_PROJECTS_AT_RISK;

  return {
    totalProjects,
    totalCapacity,
    utilizationPct,
    capacityGap,
    activeSuppliers,
    projectsAtRisk,

    availableCapacity: totalCapacity,
    allocatedCapacity,
    usedCapacity,
    remainingCapacity,

    activeProjects,
    projectsOnTrack: MOCK_PROJECTS_ON_TRACK,
    projectsDelayed: MOCK_PROJECTS_DELAYED,
    projectsCompleted: MOCK_PROJECTS_COMPLETED,

    openQualityIssues: MOCK_OPEN_QUALITY_ISSUES,
    criticalQualityIssues: MOCK_CRITICAL_QUALITY_ISSUES,
    openActions: MOCK_OPEN_ACTIONS,
    supplierQualityStatus: MOCK_SUPPLIER_QUALITY_STATUS,

    projectsByCustomer: MOCK_PROJECTS_BY_CUSTOMER,
    upcomingMilestones: MOCK_UPCOMING_MILESTONES,

    isLoading,
    error: error ?? null,
    refetch,
  };
}
