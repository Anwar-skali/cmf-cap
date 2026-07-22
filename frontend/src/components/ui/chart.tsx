import { type HTMLAttributes } from 'react';
import {
  BarChart as RechartsBarChart,
  Bar,
  LineChart as RechartsLineChart,
  Line,
  PieChart as RechartsPieChart,
  Pie,
  AreaChart as RechartsAreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  type TooltipProps,
} from 'recharts';
import { cn } from '@/lib/utils';

interface ChartContainerProps extends HTMLAttributes<HTMLDivElement> {
  height?: number;
}

function ChartContainer({ className, height = 400, children, ...props }: ChartContainerProps) {
  return (
    <div
      className={cn('w-full', className)}
      style={{ height }}
      {...props}
    >
      <ResponsiveContainer width="100%" height="100%">
        {children as React.ReactElement}
      </ResponsiveContainer>
    </div>
  );
}

const CHART_COLORS = [
  'hsl(var(--primary))',
  'hsl(217.2, 91.2%, 59.8%)',
  'hsl(142.1, 76.2%, 36.3%)',
  'hsl(27.9, 100%, 50%)',
  'hsl(0, 84.2%, 60.2%)',
  'hsl(271.5, 81.3%, 55.9%)',
  'hsl(186.8, 57.8%, 49%)',
  'hsl(45.4, 93.4%, 47.5%)',
];

function CustomTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-background p-3 shadow-lg">
      <p className="mb-1 text-sm font-medium">{label}</p>
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-2 text-sm">
          <div
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-medium">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

interface BarChartProps {
  data: Record<string, unknown>[];
  dataKey: string;
  xAxisKey: string;
  bars?: { dataKey: string; name: string; color?: string; stackId?: string }[];
  height?: number;
  showGrid?: boolean;
  showLegend?: boolean;
  className?: string;
}

function BarChart({
  data,
  dataKey: mainDataKey,
  xAxisKey,
  bars,
  height = 400,
  showGrid = true,
  showLegend = true,
  className,
}: BarChartProps) {
  const barItems = bars ?? [{ dataKey: mainDataKey, name: mainDataKey }];

  return (
    <ChartContainer height={height} className={className}>
      <RechartsBarChart data={data}>
        {showGrid && <CartesianGrid strokeDasharray="3 3" className="stroke-border" />}
        <XAxis
          dataKey={xAxisKey}
          tick={{ fontSize: 12 }}
          className="text-muted-foreground"
          tickLine={false}
          axisLine={false}
        />
        <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" tickLine={false} axisLine={false} />
        <Tooltip content={<CustomTooltip />} />
        {showLegend && <Legend />}
        {barItems.map((bar, index) => (
          <Bar
            key={bar.dataKey}
            dataKey={bar.dataKey}
            name={bar.name}
            fill={bar.color ?? CHART_COLORS[index % CHART_COLORS.length]}
            radius={[4, 4, 0, 0]}
            stackId={bar.stackId}
          />
        ))}
      </RechartsBarChart>
    </ChartContainer>
  );
}

interface LineChartProps {
  data: Record<string, unknown>[];
  dataKey: string;
  xAxisKey: string;
  lines?: { dataKey: string; name: string; color?: string }[];
  height?: number;
  showGrid?: boolean;
  showLegend?: boolean;
  showDots?: boolean;
  className?: string;
}

function LineChart({
  data,
  dataKey: mainDataKey,
  xAxisKey,
  lines,
  height = 400,
  showGrid = true,
  showLegend = true,
  showDots = true,
  className,
}: LineChartProps) {
  const lineItems = lines ?? [{ dataKey: mainDataKey, name: mainDataKey }];

  return (
    <ChartContainer height={height} className={className}>
      <RechartsLineChart data={data}>
        {showGrid && <CartesianGrid strokeDasharray="3 3" className="stroke-border" />}
        <XAxis
          dataKey={xAxisKey}
          tick={{ fontSize: 12 }}
          className="text-muted-foreground"
          tickLine={false}
          axisLine={false}
        />
        <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" tickLine={false} axisLine={false} />
        <Tooltip content={<CustomTooltip />} />
        {showLegend && <Legend />}
        {lineItems.map((line, index) => (
          <Line
            key={line.dataKey}
            type="monotone"
            dataKey={line.dataKey}
            name={line.name}
            stroke={line.color ?? CHART_COLORS[index % CHART_COLORS.length]}
            strokeWidth={2}
            dot={showDots ? { r: 4 } : false}
            activeDot={{ r: 6 }}
          />
        ))}
      </RechartsLineChart>
    </ChartContainer>
  );
}

interface PieChartProps {
  data: Record<string, unknown>[];
  dataKey: string;
  nameKey: string;
  height?: number;
  showLegend?: boolean;
  colors?: string[];
  innerRadius?: number;
  outerRadius?: number;
  className?: string;
}

function PieChart({
  data,
  dataKey,
  nameKey,
  height = 400,
  showLegend = true,
  colors = CHART_COLORS,
  innerRadius = 0,
  outerRadius = 130,
  className,
}: PieChartProps) {
  return (
    <ChartContainer height={height} className={className}>
      <RechartsPieChart>
        <Pie
          data={data}
          dataKey={dataKey}
          nameKey={nameKey}
          cx="50%"
          cy="50%"
          innerRadius={innerRadius}
          outerRadius={outerRadius}
          paddingAngle={2}
        >
          {data.map((_, index) => (
            <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        {showLegend && <Legend />}
      </RechartsPieChart>
    </ChartContainer>
  );
}

interface AreaChartProps {
  data: Record<string, unknown>[];
  dataKey: string;
  xAxisKey: string;
  areas?: { dataKey: string; name: string; color?: string }[];
  height?: number;
  showGrid?: boolean;
  showLegend?: boolean;
  showDots?: boolean;
  className?: string;
}

function AreaChart({
  data,
  dataKey: mainDataKey,
  xAxisKey,
  areas,
  height = 400,
  showGrid = true,
  showLegend = true,
  showDots = true,
  className,
}: AreaChartProps) {
  const areaItems = areas ?? [{ dataKey: mainDataKey, name: mainDataKey }];

  return (
    <ChartContainer height={height} className={className}>
      <RechartsAreaChart data={data}>
        {showGrid && <CartesianGrid strokeDasharray="3 3" className="stroke-border" />}
        <XAxis
          dataKey={xAxisKey}
          tick={{ fontSize: 12 }}
          className="text-muted-foreground"
          tickLine={false}
          axisLine={false}
        />
        <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" tickLine={false} axisLine={false} />
        <Tooltip content={<CustomTooltip />} />
        {showLegend && <Legend />}
        {areaItems.map((area, index) => {
          const color = area.color ?? CHART_COLORS[index % CHART_COLORS.length];
          return (
            <Area
              key={area.dataKey}
              type="monotone"
              dataKey={area.dataKey}
              name={area.name}
              stroke={color}
              fill={color}
              fillOpacity={0.15}
              strokeWidth={2}
              dot={showDots ? { r: 4 } : false}
              activeDot={{ r: 6 }}
            />
          );
        })}
      </RechartsAreaChart>
    </ChartContainer>
  );
}

export { BarChart, LineChart, PieChart, AreaChart, ChartContainer };
export type { BarChartProps, LineChartProps, PieChartProps, AreaChartProps };
export { CHART_COLORS };
