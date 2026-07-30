import React from 'react';
import { LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';

interface KPICardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: string;
    isPositive?: boolean;
  };
  subtitle?: string;
  accentColor?: string;
  actionText?: string;
  actionHref?: string;
  onClickAction?: () => void;
  variant?: 'ltos' | 'compact';
}

export const KPICard: React.FC<KPICardProps> = ({
  title,
  value,
  icon: Icon,
  trend,
  subtitle,
  accentColor = '#0066CC',
  actionText,
  actionHref,
  onClickAction,
  variant = 'ltos',
}) => {
  if (variant === 'compact') {
    return (
      <motion.div
        whileHover={{ y: -3, transition: { duration: 0.2 } }}
        className="group relative flex flex-col justify-between rounded-2xl border border-border bg-card p-5 shadow-sm transition-all duration-200 hover:border-primary/50 hover:shadow-xl hover:shadow-primary/5"
      >
        <div className="flex items-center justify-between gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-all duration-200 group-hover:scale-105"
            style={{ backgroundColor: `${accentColor}18`, color: accentColor }}
          >
            <Icon className="h-5 w-5" />
          </div>

          {trend && (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                trend.isPositive !== false
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
              }`}
            >
              {trend.isPositive !== false ? '↑' : '↓'} {trend.value}
            </span>
          )}
        </div>

        <div className="mt-4 space-y-1">
          <span className="text-sm font-medium text-muted-foreground tracking-tight">{title}</span>
          <div className="text-[34px] font-extrabold tracking-tight text-foreground leading-none">
            {value}
          </div>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1 font-normal">
              {subtitle}
            </p>
          )}
        </div>

        <div
          className="absolute bottom-0 left-6 right-6 h-[2px] rounded-full opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{ backgroundColor: accentColor }}
        />
      </motion.div>
    );
  }

  // Default: LTOS Style Card (Centered Top Boxed Icon, Bold Title, Subtext Label, Big Value, Pill Action/Badge)
  return (
    <motion.div
      whileHover={{ y: -4, transition: { duration: 0.25 } }}
      className="group relative flex flex-col justify-between items-center text-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-card p-6 shadow-md shadow-slate-900/5 transition-all duration-300 hover:shadow-xl hover:border-blue-500/40"
    >
      {/* Top Center Icon Box (LTOS Style) */}
      <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/90 text-slate-900 dark:text-slate-100 shadow-xs mb-3 group-hover:border-blue-500 group-hover:text-blue-600 transition-colors">
        <Icon className="h-6 w-6 stroke-[2.2]" />
      </div>

      {/* Card Title (Bold Centered Title) */}
      <h3 className="text-lg lg:text-xl font-bold tracking-tight text-foreground">{title}</h3>

      {/* Value Display (Big Crisp Font) */}
      <div className="text-3xl lg:text-4xl font-extrabold tracking-tight text-foreground my-2">
        {value}
      </div>

      {/* Sub-label Description Text */}
      {subtitle && (
        <p className="text-xs text-muted-foreground leading-relaxed max-w-xs px-1 min-h-[36px] flex items-center justify-center">
          {subtitle}
        </p>
      )}

      {/* Action Section / Badges */}
      <div className="mt-4 flex flex-col items-center gap-2">
        {trend && (
          <span
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${
              trend.isPositive !== false
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
            }`}
          >
            {trend.isPositive !== false ? '↑' : '↓'} {trend.value}
          </span>
        )}

        {actionText && (
          actionHref ? (
            <a
              href={actionHref}
              className="inline-flex items-center justify-center rounded-full bg-[#0066CC] hover:bg-[#0052A3] text-white text-xs font-bold px-6 py-2 transition-all shadow-sm shadow-blue-500/20 active:scale-95"
            >
              {actionText}
            </a>
          ) : (
            <button
              type="button"
              onClick={onClickAction}
              className="inline-flex items-center justify-center rounded-full bg-[#0066CC] hover:bg-[#0052A3] text-white text-xs font-bold px-6 py-2 transition-all shadow-sm shadow-blue-500/20 active:scale-95 cursor-pointer"
            >
              {actionText}
            </button>
          )
        )}
      </div>

      {/* Top Border Accent Line */}
      <div className="absolute top-0 left-8 right-8 h-[2px] rounded-t-full bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
    </motion.div>
  );
};

