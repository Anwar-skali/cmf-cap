/**
 * useCmfDashboardData
 *
 * Centralised data layer for the CMF Dashboard.
 * Consumes real-time calculated metrics and distributions from GET /api/v1/dashboard/stats
 */

import { useDashboardStatsQuery } from '@/hooks/queries/useDashboardQuery';
import { useProjectsQuery } from '@/hooks/queries/useProjectsQuery';
import { usePartsQuery } from '@/hooks/queries/usePartsQuery';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export interface CmfDashboardData {
  // ── KPIs ──────────────────────────────────────────────────────────────────
  totalCmf: number;
  totalProjects: number;
  totalCapacity: number;
  utilizationPct: number;
  capacityGap: number;
  totalSuppliers: number;
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
  projectUseCases: number;
  delayedProjectUseCases: number;
  completedProjectUseCases: number;
  totalParts: number;
  activeParts: number;

  // ── SQD Overview ─────────────────────────────────────────────────────────
  openQualityIssues: number;
  criticalQualityIssues: number;
  openActions: number;
  mitigatedRisks: number;
  supplierQualityStatus: string;

  // ── Buyer / Project Overview ──────────────────────────────────────────────
  projectsByCustomer: Array<{ customer: string; count: number }>;
  upcomingMilestones: number;

  // ── Dynamic Chart Formats ─────────────────────────────────────────────────
  capacityTrend: Array<{ month: string; available: number; allocated: number; used: number }>;
  projectStatusBar: Array<{ name: string; count: number }>;
  sqdPie: Array<{ name: string; value: number }>;

  // ── Loading state ─────────────────────────────────────────────────────────
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useCmfDashboardData(): CmfDashboardData {
  const { data: stats, isLoading, error, refetch } = useDashboardStatsQuery();
  const { data: projectsData } = useProjectsQuery({ pageSize: 1000 });

  const rawProjects = projectsData?.items ?? [];
  const isCompleted = (p: any) => {
    const s = String(p.status || '').toLowerCase().trim();
    const ds = String(p.data?.status || '').toLowerCase().trim();
    return (
      ['completed', 'closed', 'validated', 'done', 'complete'].includes(s) ||
      ['completed', 'closed', 'validated', 'done', 'complete'].includes(ds)
    );
  };
  const isActive = (p: any) => {
    const s = String(p.status || '').toLowerCase().trim();
    return ['active', 'in_progress', 'started'].includes(s);
  };

  const totalCmf = stats?.totalCmf ?? (stats as any)?.total_cmf ?? 0;
  const totalProjects = stats?.totalProjects ?? (stats as any)?.total_projects ?? rawProjects.length ?? 0;
  const activeProjects = stats?.activeProjects ?? (stats as any)?.active_projects ?? rawProjects.filter(isActive).length ?? 0;
  const totalSuppliers = stats?.totalSuppliers ?? (stats as any)?.total_suppliers ?? 0;
  const activeSuppliers = stats?.activeSuppliers ?? (stats as any)?.active_suppliers ?? stats?.totalSuppliers ?? 0;

  // Capacity metrics
  const totalCapacity = stats?.totalCapacity ?? (stats as any)?.total_capacity ?? 0;
  const allocatedCapacity = stats?.allocatedCapacity ?? (stats as any)?.allocated_capacity ?? 0;
  const usedCapacity = stats?.usedCapacity ?? (stats as any)?.used_capacity ?? allocatedCapacity;
  const remainingCapacity = stats?.remainingCapacity ?? (stats as any)?.remaining_capacity ?? Math.max(0, totalCapacity - usedCapacity);
  const utilizationPct = stats?.averageUtilizationPct ?? (stats as any)?.average_utilization_pct
    ? Math.round(stats?.averageUtilizationPct ?? (stats as any)?.average_utilization_pct)
    : (totalCapacity > 0 ? Math.round((usedCapacity / totalCapacity) * 100) : 0);
  const capacityGap = stats?.capacityGap ?? (stats as any)?.capacity_gap ?? Math.max(0, totalCapacity - allocatedCapacity);

  // Projects & Use cases
  const projectsDelayed = stats?.delayedProjects ?? (stats as any)?.delayed_projects ?? 0;
  const rawOnTrack = rawProjects.filter((p: any) => {
    const s = String(p.status || '').toLowerCase().trim();
    const ds = String(p.data?.status || '').toLowerCase().trim();
    const isDelayed = s === 'delayed' || ds === 'delayed' || s === 'on_hold';
    return !isDelayed && !isCompleted(p);
  }).length;
  const projectsOnTrack =
    stats?.projectsOnTrack ??
    (stats as any)?.projects_on_track ??
    (rawOnTrack > 0 ? rawOnTrack : Math.max(0, totalProjects - projectsDelayed));
  const projectsCompleted =
    stats?.completedProjects ??
    (stats as any)?.completed_projects ??
    rawProjects.filter(isCompleted).length ??
    0;
  const projectUseCases =
    stats?.projectUseCases ??
    (stats as any)?.project_use_cases ??
    totalProjects;
  const delayedProjectUseCases =
    stats?.delayedProjectUseCases ??
    (stats as any)?.delayed_project_use_cases ??
    projectsDelayed;
  const completedProjectUseCases =
    (stats as any)?.completed_project_use_cases ??
    rawProjects.filter(isCompleted).length;

  const { data: partsData } = usePartsQuery({ pageSize: 1000 });
  const rawParts = partsData?.items ?? [];
  const totalParts =
    stats?.totalParts ??
    (stats as any)?.total_parts ??
    (rawParts.length > 0 ? (partsData?.total ?? rawParts.length) : totalProjects);
  const activeParts =
    stats?.activeParts ??
    (stats as any)?.active_parts ??
    (rawParts.length > 0
      ? rawParts.filter((p: any) => (p.status || 'active').toLowerCase() !== 'obsolete' && (p.status || 'active').toLowerCase() !== 'inactive').length
      : totalParts);

  // Risks & SQD
  const projectsAtRisk = stats?.openRisks ?? 0;
  const openQualityIssues = stats?.openQualityIssues ?? 0;
  const criticalQualityIssues = stats?.criticalQualityIssues ?? stats?.criticalRisks ?? 0;
  const openActions = stats?.openActions ?? stats?.openRisks ?? 0;
  const mitigatedRisks = stats?.mitigatedRisks ?? (stats as any)?.mitigated_risks ?? 0;
  const supplierQualityStatus = stats?.supplierQualityStatus ?? 'GREEN';
  const upcomingMilestones = stats?.upcomingMilestones ?? 0;

  // Customer Breakdown
  let projectsByCustomer: Array<{ customer: string; count: number }> = [];
  if (stats?.projectsByCustomer && stats.projectsByCustomer.length > 0) {
    projectsByCustomer = stats.projectsByCustomer;
  } else if (rawProjects.length > 0) {
    const counts: Record<string, number> = {};
    rawProjects.forEach((p: any) => {
      const cname = p.client_name || p.clientName || p.data?.customer || 'Other';
      counts[cname] = (counts[cname] || 0) + 1;
    });
    projectsByCustomer = Object.entries(counts)
      .map(([customer, count]) => ({ customer, count }))
      .sort((a, b) => b.count - a.count);
  }

  // Capacity Trend Chart
  let capacityTrend: Array<{ month: string; available: number; allocated: number; used: number }> = [];
  if (stats?.monthlyCapacity && stats.monthlyCapacity.length > 0) {
    const hasData = stats.monthlyCapacity.some((m) => (m.totalCapacity || 0) > 0 || (m.utilized || 0) > 0);
    if (hasData) {
      capacityTrend = stats.monthlyCapacity.map((m) => ({
        month: MONTH_NAMES[(m.month - 1) % 12] || `M${m.month}`,
        available: m.totalCapacity || 0,
        allocated: m.utilized || 0,
        used: m.utilized || 0,
      }));
    } else if (totalCapacity > 0) {
      capacityTrend = stats.monthlyCapacity.map((m) => ({
        month: MONTH_NAMES[(m.month - 1) % 12] || `M${m.month}`,
        available: totalCapacity,
        allocated: allocatedCapacity,
        used: usedCapacity,
      }));
    }
  }

  // Project Status Bar Chart
  const statusDist = stats?.projectStatusDistribution || {};
  const projectStatusBar: Array<{ name: string; count: number }> = [
    { name: 'Active', count: statusDist.active ?? activeProjects },
    { name: 'On Track', count: projectsOnTrack },
    { name: 'At Risk', count: projectsAtRisk },
    { name: 'Delayed', count: projectsDelayed },
    { name: 'Completed', count: statusDist.completed ?? projectsCompleted },
  ];

  // SQD Pie Chart
  const riskSeverity = stats?.riskDistribution?.bySeverity || {};
  const riskStatus = stats?.riskDistribution?.byStatus || {};
  const sqdPie: Array<{ name: string; value: number }> = [
    { name: 'Open', value: riskStatus.open ?? stats?.openRisks ?? 0 },
    { name: 'Critical', value: riskSeverity.critical ?? stats?.criticalRisks ?? 0 },
    { name: 'Closed', value: (riskStatus.closed ?? 0) + (riskStatus.mitigated ?? stats?.mitigatedRisks ?? 0) },
    { name: 'In Progress', value: (riskStatus.mitigating ?? 0) + (riskStatus.in_progress ?? 0) },
  ].filter((item) => item.value > 0);

  return {
    totalCmf,
    totalProjects,
    totalCapacity,
    utilizationPct,
    capacityGap,
    totalSuppliers,
    activeSuppliers,
    projectsAtRisk,

    availableCapacity: totalCapacity,
    allocatedCapacity,
    usedCapacity,
    remainingCapacity,

    activeProjects,
    projectsOnTrack,
    projectsDelayed,
    projectsCompleted,
    projectUseCases,
    delayedProjectUseCases,
    completedProjectUseCases,
    totalParts,
    activeParts,

    openQualityIssues,
    criticalQualityIssues,
    openActions,
    mitigatedRisks,
    supplierQualityStatus,

    projectsByCustomer,
    upcomingMilestones,

    capacityTrend,
    projectStatusBar,
    sqdPie,

    isLoading,
    error: error ?? null,
    refetch,
  };
}
