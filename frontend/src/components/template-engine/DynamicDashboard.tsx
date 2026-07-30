import React from 'react';
import { CMFTemplate, DashboardKpi, DashboardChart } from '@/types/template';
import { Project } from '@/types';
import { TrendingUp, BarChart3 } from 'lucide-react';
import { KPICard } from '@/components/ui/KPICard';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

interface DynamicDashboardProps {
  template: CMFTemplate;
  projects: Project[];
}

export const DynamicDashboard: React.FC<DynamicDashboardProps> = ({ template, projects }) => {
  const config = template.dashboardConfig || template.schema_json?.dashboardConfig;

  // Compute KPI values dynamically
  const computeKpiValue = (kpi: DashboardKpi) => {
    if (projects.length === 0) return 0;

    const values = projects
      .map((p) => Number(p.data?.[kpi.field] ?? (p as any)[kpi.field]))
      .filter((v) => !isNaN(v) && v !== null && v !== undefined);

    if (values.length === 0) return 0;

    if (kpi.aggregation === 'sum') {
      const sum = values.reduce((acc, curr) => acc + curr, 0);
      return sum;
    }
    if (kpi.aggregation === 'avg') {
      const avg = values.reduce((acc, curr) => acc + curr, 0) / values.length;
      return Number(avg.toFixed(1));
    }
    if (kpi.aggregation === 'count') {
      return values.length;
    }

    return 0;
  };

  const formatKpi = (val: number, format: string) => {
    if (format === 'currency') return `€${val.toLocaleString('fr-FR')}`;
    if (format === 'percentage') return `${val}%`;
    return val.toLocaleString();
  };

  // Group chart data dynamically
  const prepareChartData = (chart: DashboardChart) => {
    const groups: Record<string, any> = {};

    projects.forEach((p) => {
      const groupKey = String(p.data?.[chart.groupBy] ?? (p as any)[chart.groupBy] ?? 'Other');
      if (!groups[groupKey]) {
        groups[groupKey] = { name: groupKey, count: 0 };
        chart.metrics.forEach((m) => (groups[groupKey][m.field] = 0));
      }

      groups[groupKey].count += 1;
      chart.metrics.forEach((m) => {
        const val = Number(p.data?.[m.field] ?? (p as any)[m.field]) || 0;
        groups[groupKey][m.field] += val;
      });
    });

    return Object.values(groups);
  };

  const PIE_COLORS = ['#0066CC', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  return (
    <div className="space-y-6">
      {/* Dynamic KPI Metric Cards (LTOS Style) */}
      {config?.kpis && config.kpis.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {config.kpis.map((kpi) => {
            const rawVal = computeKpiValue(kpi);
            const formatted = formatKpi(rawVal, kpi.format);

            return (
              <KPICard
                key={kpi.id}
                variant="ltos"
                title={kpi.title}
                value={formatted}
                icon={TrendingUp}
                subtitle={`Aggregated (${kpi.aggregation.toUpperCase()}) across ${projects.length} project records`}
                accentColor="#0066CC"
              />
            );
          })}
        </div>
      )}

      {/* Dynamic Charts (LTOS Container Style) */}
      {config?.charts && config.charts.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {config.charts.map((chart) => {
            const chartData = prepareChartData(chart);

            return (
              <div
                key={chart.id}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-card p-6 shadow-md shadow-slate-900/5 space-y-4"
              >
                <div className="flex items-center gap-3 border-b border-border pb-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-blue-600">
                    <BarChart3 className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-foreground">{chart.title}</h3>
                    <p className="text-xs text-muted-foreground">Grouped by {chart.groupBy}</p>
                  </div>
                </div>

                <div className="h-64 w-full pt-2">
                  {chart.type === 'bar' ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                        <XAxis dataKey="name" stroke="#888888" fontSize={11} />
                        <YAxis stroke="#888888" fontSize={11} />
                        <Tooltip />
                        {chart.metrics.map((m) => (
                          <Bar key={m.field} dataKey={m.field} fill={m.color || '#0066CC'} radius={[6, 6, 0, 0]} name={m.label} />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={chartData}
                          dataKey="count"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        >
                          {chartData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend fontSize={11} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

