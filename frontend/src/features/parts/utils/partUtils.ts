import type { ProjectPart, PartStatus } from '@/types';

export const PART_STATUS_COLORS: Record<PartStatus, { bg: string; text: string; border: string }> = {
  active: {
    bg: 'bg-emerald-500/10 dark:bg-emerald-500/20',
    text: 'text-emerald-600 dark:text-emerald-400',
    border: 'border-emerald-500/30',
  },
  inactive: {
    bg: 'bg-slate-500/10 dark:bg-slate-500/20',
    text: 'text-slate-600 dark:text-slate-400',
    border: 'border-slate-500/30',
  },
  obsolete: {
    bg: 'bg-rose-500/10 dark:bg-rose-500/20',
    text: 'text-rose-600 dark:text-rose-400',
    border: 'border-rose-500/30',
  },
};

export const MATERIAL_PALETTES: Record<string, { bg: string; text: string; border: string }> = {
  steel: { bg: 'bg-slate-500/15', text: 'text-slate-700 dark:text-slate-300', border: 'border-slate-400/30' },
  aluminum: { bg: 'bg-cyan-500/15', text: 'text-cyan-700 dark:text-cyan-300', border: 'border-cyan-400/30' },
  plastic: { bg: 'bg-amber-500/15', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-400/30' },
  rubber: { bg: 'bg-emerald-500/15', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-400/30' },
  composite: { bg: 'bg-purple-500/15', text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-400/30' },
  copper: { bg: 'bg-orange-500/15', text: 'text-orange-700 dark:text-orange-300', border: 'border-orange-400/30' },
  glass: { bg: 'bg-blue-500/15', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-400/30' },
};

const PART_PALETTES = [
  { bg: 'bg-blue-500/15', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-500/30' },
  { bg: 'bg-indigo-500/15', text: 'text-indigo-600 dark:text-indigo-400', border: 'border-indigo-500/30' },
  { bg: 'bg-emerald-500/15', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-500/30' },
  { bg: 'bg-amber-500/15', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-500/30' },
  { bg: 'bg-rose-500/15', text: 'text-rose-600 dark:text-rose-400', border: 'border-rose-500/30' },
  { bg: 'bg-purple-500/15', text: 'text-purple-600 dark:text-purple-400', border: 'border-purple-500/30' },
  { bg: 'bg-teal-500/15', text: 'text-teal-600 dark:text-teal-400', border: 'border-teal-500/30' },
];

export function getPartInitials(name: string): string {
  if (!name) return 'PT';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function getPartAvatarStyle(name: string) {
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % PART_PALETTES.length;
  return PART_PALETTES[index];
}

export function getMaterialStyle(material?: string) {
  if (!material) {
    return { bg: 'bg-slate-500/10', text: 'text-slate-600 dark:text-slate-400', border: 'border-slate-500/20' };
  }
  const key = material.toLowerCase().trim();
  for (const [matKey, style] of Object.entries(MATERIAL_PALETTES)) {
    if (key.includes(matKey)) {
      return style;
    }
  }
  return { bg: 'bg-indigo-500/10', text: 'text-indigo-600 dark:text-indigo-400', border: 'border-indigo-500/20' };
}

export function formatPartStatus(status?: PartStatus | string): string {
  if (!status) return 'Active';
  const map: Record<string, string> = {
    active: 'Active',
    inactive: 'Inactive',
    obsolete: 'Obsolete',
  };
  return map[status.toLowerCase()] || status.charAt(0).toUpperCase() + status.slice(1);
}

export function getPartStatusVariant(status: PartStatus | string): 'success' | 'secondary' | 'destructive' {
  switch (status) {
    case 'active':
      return 'success';
    case 'obsolete':
      return 'destructive';
    case 'inactive':
    default:
      return 'secondary';
  }
}

export interface PartsMetrics {
  totalParts: number;
  activeCount: number;
  inactiveCount: number;
  obsoleteCount: number;
  totalQuantity: number;
  totalWeight: number;
  uniqueSuppliersCount: number;
  uniqueMaterialsCount: number;
  statusBreakdown: { name: string; value: number; color: string }[];
  materialBreakdown: { material: string; count: number }[];
  supplierBreakdown: { supplier: string; count: number }[];
}

export function calculatePartsMetrics(parts: ProjectPart[]): PartsMetrics {
  let activeCount = 0;
  let inactiveCount = 0;
  let obsoleteCount = 0;
  let totalQuantity = 0;
  let totalWeight = 0;

  const suppliersSet = new Set<string>();
  const materialsMap = new Map<string, number>();
  const suppliersMap = new Map<string, number>();

  for (const part of parts) {
    // Status counts
    if (part.status === 'active') activeCount++;
    else if (part.status === 'inactive') inactiveCount++;
    else if (part.status === 'obsolete') obsoleteCount++;

    // Quantities and weights
    totalQuantity += Number(part.quantity) || 0;
    if (part.weight) {
      totalWeight += (Number(part.weight) || 0) * (Number(part.quantity) || 1);
    }

    // Suppliers
    const supplierName = part.supplier?.name || (part.supplierId ? `Supplier #${part.supplierId.slice(0, 5)}` : 'Unassigned');
    if (part.supplier?.name || part.supplierId) {
      suppliersSet.add(supplierName);
    }
    suppliersMap.set(supplierName, (suppliersMap.get(supplierName) || 0) + 1);

    // Materials
    const materialName = part.material?.trim() || 'Unspecified';
    materialsMap.set(materialName, (materialsMap.get(materialName) || 0) + 1);
  }

  const statusBreakdown = [
    { name: 'Active', value: activeCount, color: '#10b981' },
    { name: 'Inactive', value: inactiveCount, color: '#94a3b8' },
    { name: 'Obsolete', value: obsoleteCount, color: '#ef4444' },
  ];

  const materialBreakdown = Array.from(materialsMap.entries())
    .map(([material, count]) => ({ material, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  const supplierBreakdown = Array.from(suppliersMap.entries())
    .map(([supplier, count]) => ({ supplier, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  return {
    totalParts: parts.length,
    activeCount,
    inactiveCount,
    obsoleteCount,
    totalQuantity,
    totalWeight,
    uniqueSuppliersCount: suppliersSet.size,
    uniqueMaterialsCount: Array.from(materialsMap.keys()).filter((m) => m !== 'Unspecified').length,
    statusBreakdown,
    materialBreakdown,
    supplierBreakdown,
  };
}

export function exportPartsToCsv(parts: ProjectPart[], filename = 'cmf-parts-catalog.csv') {
  const headers = [
    'Part ID',
    'Part Name',
    'Part Number',
    'Status',
    'Quantity',
    'Unit',
    'Material',
    'Weight (kg)',
    'Supplier Name',
    'Supplier Code',
    'Project ID',
    'Description',
    'Notes',
    'Created Date',
  ];

  const rows = parts.map((p) => [
    `"${p.id}"`,
    `"${(p.name || '').replace(/"/g, '""')}"`,
    `"${(p.partNumber || '').replace(/"/g, '""')}"`,
    `"${p.status || 'active'}"`,
    `"${p.quantity || 0}"`,
    `"${p.unit || 'pcs'}"`,
    `"${(p.material || '').replace(/"/g, '""')}"`,
    `"${p.weight ?? ''}"`,
    `"${(p.supplier?.name || '').replace(/"/g, '""')}"`,
    `"${(p.supplier?.code || '').replace(/"/g, '""')}"`,
    `"${p.projectId || ''}"`,
    `"${(p.description || '').replace(/"/g, '""')}"`,
    `"${(p.notes || '').replace(/"/g, '""')}"`,
    `"${p.createdAt || ''}"`,
  ]);

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
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

export function exportPartsToJson(parts: ProjectPart[], filename = 'cmf-parts-catalog.json') {
  const jsonString = JSON.stringify(parts, null, 2);
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
