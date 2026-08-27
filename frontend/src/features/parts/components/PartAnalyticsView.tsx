import type { ProjectPart } from '@/types';
import { calculatePartsMetrics } from '../utils/partUtils';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from 'recharts';
import {
  PieChart as PieChartIcon,
  BarChart3,
  Layers,
  Building2,
  Boxes,
  Scale,
  Sparkles,
} from 'lucide-react';

interface PartAnalyticsViewProps {
  parts: ProjectPart[];
}

export function PartAnalyticsView({ parts }: PartAnalyticsViewProps) {
  const metrics = calculatePartsMetrics(parts);

  const avgQuantity =
    metrics.totalParts > 0 ? Math.round(metrics.totalQuantity / metrics.totalParts) : 0;
  const partsWithSupplier = parts.filter((p) => p.supplier?.name || p.supplierId).length;
  const supplierCoverage =
    metrics.totalParts > 0 ? Math.round((partsWithSupplier / metrics.totalParts) * 100) : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 4 Summary Stat Mini Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600 border border-blue-500/20 shrink-0">
            <Boxes className="h-6 w-6" />
          </div>
          <div className="space-y-0.5 min-w-0">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Avg Units / Part</p>
            <p className="text-xl font-black text-foreground">{avgQuantity.toLocaleString()} pcs</p>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-600 border border-indigo-500/20 shrink-0">
            <Layers className="h-6 w-6" />
          </div>
          <div className="space-y-0.5 min-w-0">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Material Classes</p>
            <p className="text-xl font-black text-foreground">{metrics.uniqueMaterialsCount} distinct</p>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 shrink-0">
            <Building2 className="h-6 w-6" />
          </div>
          <div className="space-y-0.5 min-w-0">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Supplier Sourcing</p>
            <p className="text-xl font-black text-foreground">{supplierCoverage}% mapped</p>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 border border-amber-500/20 shrink-0">
            <Scale className="h-6 w-6" />
          </div>
          <div className="space-y-0.5 min-w-0">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total BOM Mass</p>
            <p className="text-xl font-black text-foreground">
              {metrics.totalWeight > 0 ? `${metrics.totalWeight.toLocaleString()} kg` : 'N/A'}
            </p>
          </div>
        </div>
      </div>

      {/* Row of Charts: Status Breakdown & Material Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Distribution Card */}
        <div className="rounded-3xl border border-border bg-card p-6 shadow-md space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600">
                <PieChartIcon className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-base font-black text-foreground">Lifecycle Status Distribution</h3>
                <p className="text-xs text-muted-foreground">Proportion of active, inactive, and obsolete parts</p>
              </div>
            </div>
            <span className="text-xs font-bold text-muted-foreground">{metrics.totalParts} Total Parts</span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={metrics.statusBreakdown}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={85}
                  paddingAngle={4}
                  label={({ name, percent }) =>
                    percent > 0 ? `${name} ${(percent * 100).toFixed(0)}%` : ''
                  }
                >
                  {metrics.statusBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Material Breakdown Bar Chart */}
        <div className="rounded-3xl border border-border bg-card p-6 shadow-md space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600">
                <BarChart3 className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-base font-black text-foreground">Top Materials Composition</h3>
                <p className="text-xs text-muted-foreground">Parts count by raw material specification</p>
              </div>
            </div>
            <span className="text-xs font-bold text-muted-foreground">BOM Materials</span>
          </div>

          <div className="h-64 w-full">
            {metrics.materialBreakdown.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                No material breakdown available
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.materialBreakdown} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
                  <XAxis dataKey="material" stroke="#888888" fontSize={11} angle={-20} textAnchor="end" />
                  <YAxis stroke="#888888" fontSize={11} allowDecimals={false} />
                  <RechartsTooltip />
                  <Bar dataKey="count" fill="#0066CC" radius={[6, 6, 0, 0]} name="Parts Count">
                    {metrics.materialBreakdown.map((_, index) => {
                      const shades = ['#0066CC', '#4f46e5', '#06b6d4', '#10b981', '#f59e0b', '#8b5cf6'];
                      return <Cell key={`mat-${index}`} fill={shades[index % shades.length]} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Row 2: Top Sourcing Suppliers Breakdown */}
      <div className="rounded-3xl border border-border bg-card p-6 shadow-md space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
              <Building2 className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-black text-foreground">Supplier Allocation Distribution</h3>
              <p className="text-xs text-muted-foreground">Top suppliers by total assigned components in CMF</p>
            </div>
          </div>
          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full">
            {metrics.uniqueSuppliersCount} Active Suppliers
          </span>
        </div>

        <div className="h-64 w-full">
          {metrics.supplierBreakdown.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
              No supplier allocations recorded
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={metrics.supplierBreakdown}
                layout="vertical"
                margin={{ top: 10, right: 20, left: 40, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} horizontal={false} />
                <XAxis type="number" stroke="#888888" fontSize={11} allowDecimals={false} />
                <YAxis type="category" dataKey="supplier" stroke="#888888" fontSize={11} width={120} />
                <RechartsTooltip />
                <Bar dataKey="count" fill="#10b981" radius={[0, 6, 6, 0]} name="Assigned Parts">
                  {metrics.supplierBreakdown.map((_, index) => {
                    const shades = ['#10b981', '#059669', '#0d9488', '#0284c7', '#3b82f6'];
                    return <Cell key={`sup-${index}`} fill={shades[index % shades.length]} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
