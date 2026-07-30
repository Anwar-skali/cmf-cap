import React from 'react';
import { ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface CrudFormHeaderProps {
  breadcrumbs: BreadcrumbItem[];
  title: string;
  subtitle?: string;
  versionBadge?: string;
  extraActions?: React.ReactNode;
}

export const CrudFormHeader: React.FC<CrudFormHeaderProps> = ({
  breadcrumbs,
  title,
  subtitle,
  versionBadge = 'Latest validated LTP version: V20260629_V5',
  extraActions,
}) => {
  const navigate = useNavigate();

  return (
    <div className="relative overflow-hidden rounded-3xl bg-[#0a101d] text-white p-6 sm:p-8 lg:p-10 shadow-xl border border-slate-800">
      {/* Background Subtle Gradient Glow */}
      <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-blue-600/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-indigo-600/10 blur-3xl pointer-events-none" />

      <div className="relative z-10 space-y-4">
        {/* Top Header Row: Breadcrumb Trail & Version Badge */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <nav className="flex items-center gap-2 text-xs font-semibold text-slate-400 flex-wrap">
            {breadcrumbs.map((item, idx) => (
              <React.Fragment key={idx}>
                {idx > 0 && <ChevronRight className="h-3.5 w-3.5 text-slate-500 shrink-0" />}
                {item.href ? (
                  <span
                    onClick={() => navigate(item.href!)}
                    className="hover:text-white transition-colors cursor-pointer"
                  >
                    {item.label}
                  </span>
                ) : (
                  <span className="text-slate-200">{item.label}</span>
                )}
              </React.Fragment>
            ))}
          </nav>

          {versionBadge && (
            <div className="inline-flex items-center rounded-full border border-blue-500/40 bg-slate-900/90 px-4 py-1.5 text-xs font-bold text-blue-400 shadow-xs shrink-0 self-start sm:self-auto">
              {versionBadge}
            </div>
          )}
        </div>

        {/* Title & Description */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pt-1">
          <div className="space-y-2 max-w-3xl">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white">
              {title}
            </h1>
            {subtitle && (
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-normal">
                {subtitle}
              </p>
            )}
          </div>

          {extraActions && (
            <div className="shrink-0 flex items-center gap-3">
              {extraActions}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
