import type { Risk } from '@/types';

export const PROBABILITY_WEIGHTS: Record<string, number> = {
  rare: 1,
  unlikely: 2,
  possible: 3,
  likely: 4,
  almost_certain: 5,
};

export const SEVERITY_WEIGHTS: Record<string, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

export function getProbabilityWeight(prob?: string): number {
  if (!prob) return 2;
  return PROBABILITY_WEIGHTS[prob.toLowerCase()] ?? 2;
}

export function getSeverityWeight(sev?: string): number {
  if (!sev) return 2;
  return SEVERITY_WEIGHTS[sev.toLowerCase()] ?? 2;
}

export function calculateRiskScore(severity?: string, probability?: string, storedScore?: number): number {
  if (storedScore && storedScore > 0) return storedScore;
  const p = getProbabilityWeight(probability);
  const s = getSeverityWeight(severity);
  return s * p;
}

export function getRiskScoreLevel(score: number): {
  label: string;
  badgeClass: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
} {
  if (score >= 15) {
    return {
      label: 'Critical',
      badgeClass: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30',
      bgClass: 'bg-rose-500',
      textClass: 'text-rose-600 dark:text-rose-400',
      borderClass: 'border-rose-500',
    };
  }
  if (score >= 9) {
    return {
      label: 'High',
      badgeClass: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
      bgClass: 'bg-amber-500',
      textClass: 'text-amber-600 dark:text-amber-400',
      borderClass: 'border-amber-500',
    };
  }
  if (score >= 5) {
    return {
      label: 'Medium',
      badgeClass: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30',
      bgClass: 'bg-blue-500',
      textClass: 'text-blue-600 dark:text-blue-400',
      borderClass: 'border-blue-500',
    };
  }
  return {
    label: 'Low',
    badgeClass: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
    bgClass: 'bg-emerald-500',
    textClass: 'text-emerald-600 dark:text-emerald-400',
    borderClass: 'border-emerald-500',
  };
}

export function formatProbabilityLabel(prob?: string): string {
  if (!prob) return 'Unspecified';
  const map: Record<string, string> = {
    rare: 'Rare (1)',
    unlikely: 'Unlikely (2)',
    possible: 'Possible (3)',
    likely: 'Likely (4)',
    almost_certain: 'Almost Certain (5)',
  };
  return map[prob.toLowerCase()] || prob.charAt(0).toUpperCase() + prob.slice(1);
}

export function formatSeverityLabel(sev?: string): string {
  if (!sev) return 'Unspecified';
  const map: Record<string, string> = {
    critical: 'Critical (4)',
    high: 'High (3)',
    medium: 'Medium (2)',
    low: 'Low (1)',
  };
  return map[sev.toLowerCase()] || sev.charAt(0).toUpperCase() + sev.slice(1);
}

export function formatStatusLabel(status?: string): string {
  if (!status) return 'Open';
  const map: Record<string, string> = {
    open: 'Open',
    mitigating: 'In Mitigation',
    mitigated: 'Mitigated',
    closed: 'Closed',
  };
  return map[status.toLowerCase()] || status.charAt(0).toUpperCase() + status.slice(1);
}

export function exportRisksToCsv(risks: Risk[], filename = 'cmf-risk-registry.csv') {
  const headers = [
    'ID',
    'Title',
    'Description',
    'Severity',
    'Probability',
    'Risk Score',
    'Status',
    'Category / Type',
    'Project',
    'Part ID',
    'Assigned To',
    'Due Date',
    'Mitigation Plan',
    'Contingency Plan',
    'Created At',
  ];

  const rows = risks.map((r) => [
    `"${r.id}"`,
    `"${(r.title || '').replace(/"/g, '""')}"`,
    `"${(r.description || '').replace(/"/g, '""')}"`,
    `"${r.severity || ''}"`,
    `"${r.probability || ''}"`,
    calculateRiskScore(r.severity, r.probability, r.riskScore),
    `"${r.status || 'open'}"`,
    `"${r.riskType || 'Technical'}"`,
    `"${(r.projectName || '').replace(/"/g, '""')}"`,
    `"${r.projectPartId || ''}"`,
    `"${(r.assignedTo || '').replace(/"/g, '""')}"`,
    `"${r.dueDate || ''}"`,
    `"${(r.mitigation || '').replace(/"/g, '""')}"`,
    `"${(r.contingency || '').replace(/"/g, '""')}"`,
    `"${r.createdAt || ''}"`,
  ]);

  const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportRisksToJson(risks: Risk[], filename = 'cmf-risk-registry.json') {
  const jsonString = JSON.stringify(risks, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
