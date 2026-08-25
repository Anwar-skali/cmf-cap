import type { Supplier, SupplierStatus } from '@/types';

export const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
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
  blacklisted: {
    bg: 'bg-rose-500/10 dark:bg-rose-500/20',
    text: 'text-rose-600 dark:text-rose-400',
    border: 'border-rose-500/30',
  },
};

const AVATAR_PALETTES = [
  { bg: 'bg-blue-500/15', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-500/30' },
  { bg: 'bg-indigo-500/15', text: 'text-indigo-600 dark:text-indigo-400', border: 'border-indigo-500/30' },
  { bg: 'bg-emerald-500/15', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-500/30' },
  { bg: 'bg-amber-500/15', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-500/30' },
  { bg: 'bg-rose-500/15', text: 'text-rose-600 dark:text-rose-400', border: 'border-rose-500/30' },
  { bg: 'bg-purple-500/15', text: 'text-purple-600 dark:text-purple-400', border: 'border-purple-500/30' },
  { bg: 'bg-teal-500/15', text: 'text-teal-600 dark:text-teal-400', border: 'border-teal-500/30' },
];

export function getSupplierInitials(name: string): string {
  if (!name) return 'SP';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function getSupplierAvatarStyle(name: string) {
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_PALETTES.length;
  return AVATAR_PALETTES[index];
}

export function formatSupplierStatus(status?: string): string {
  if (!status) return 'Active';
  const map: Record<string, string> = {
    active: 'Active',
    inactive: 'Inactive',
    blacklisted: 'Blacklisted',
  };
  return map[status.toLowerCase()] || status.charAt(0).toUpperCase() + status.slice(1);
}

export function getSupplierStatusVariant(status: SupplierStatus | string): 'success' | 'secondary' | 'destructive' {
  switch (status) {
    case 'active':
      return 'success';
    case 'blacklisted':
      return 'destructive';
    case 'inactive':
    default:
      return 'secondary';
  }
}

export function exportSuppliersToCsv(suppliers: Supplier[], filename = 'cmf-supplier-directory.csv') {
  const headers = [
    'ID',
    'Supplier Name',
    'Supplier Code',
    'Contact Person',
    'Email Address',
    'Phone Number',
    'Address / Location',
    'Website',
    'Status',
    'Certifications',
    'Procurement Notes',
    'Created At',
  ];

  const rows = suppliers.map((s) => [
    `"${s.id}"`,
    `"${(s.name || '').replace(/"/g, '""')}"`,
    `"${(s.code || '').replace(/"/g, '""')}"`,
    `"${(s.contactPerson || '').replace(/"/g, '""')}"`,
    `"${(s.email || '').replace(/"/g, '""')}"`,
    `"${(s.phone || '').replace(/"/g, '""')}"`,
    `"${(s.address || '').replace(/"/g, '""')}"`,
    `"${(s.website || '').replace(/"/g, '""')}"`,
    `"${s.status || 'active'}"`,
    `"${(s.certifications || []).join(', ')}"`,
    `"${(s.notes || '').replace(/"/g, '""')}"`,
    `"${s.createdAt || ''}"`,
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

export function exportSuppliersToJson(suppliers: Supplier[], filename = 'cmf-supplier-directory.json') {
  const jsonString = JSON.stringify(suppliers, null, 2);
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
