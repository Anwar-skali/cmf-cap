import {
  LayoutDashboard,
  FolderKanban,
  Package,
  Truck,
  Gauge,
  AlertTriangle,
  FileText,
  BarChart3,
  Bell,
  Shield,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  label: string;
  icon: LucideIcon;
  path: string;
  badge?: number | string;
  adminOnly?: boolean;
}

export interface NavGroup {
  label?: string;
  items: NavItem[];
}

export const navGroups: NavGroup[] = [
  {
    items: [
      { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
    ],
  },
  {
    label: 'Management',
    items: [
      { label: 'Projects', icon: FolderKanban, path: '/projects' },
      { label: 'Parts', icon: Package, path: '/parts' },
      { label: 'Suppliers', icon: Truck, path: '/suppliers' },
    ],
  },
  {
    label: 'Analysis',
    items: [
      { label: 'Capacity', icon: Gauge, path: '/capacity' },
      { label: 'Risks', icon: AlertTriangle, path: '/risks' },
    ],
  },
  {
    label: 'Resources',
    items: [
      { label: 'Documents', icon: FileText, path: '/documents' },
      { label: 'Reports', icon: BarChart3, path: '/reports' },
    ],
  },
  {
    items: [
      { label: 'Notifications', icon: Bell, path: '/notifications', badge: 3 },
      { label: 'Admin', icon: Shield, path: '/admin', adminOnly: true },
    ],
  },
];
