// SPDX-License-Identifier: GPL-3.0-or-later


import { memo, type ReactNode } from 'react';
import { GlassCard } from '../base/GlassCard';
import SkeletonBlock from '../base/SkeletonBlock';

export type DashboardCardStatus = 'good' | 'neutral' | 'warning' | 'risk';

export type DashboardCardProps = {
  label: string;
  value: ReactNode;
  unit?: string;
  subLabel?: string;
  icon: ReactNode;
  status: DashboardCardStatus;
  percentage?: number | string;
  loading?: boolean;
  className?: string;
};

const statusClasses: Record<DashboardCardStatus, string> = {
  good: 'dashboard-card--good',
  neutral: 'dashboard-card--neutral',
  warning: 'dashboard-card--warning',
  risk: 'dashboard-card--risk'
};

function parsePercentage(value: number | string | undefined) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(100, parsed)) : null;
}

/**
 * Shared liquid-glass metric card used by every dashboard summary section.
 * The value is intentionally a ReactNode so ratios such as “0/0” can be
 * presented with the same visual hierarchy as a single metric.
 */
const DashboardCard = memo(function DashboardCard({
  label,
  value,
  unit,
  subLabel,
  icon,
  status,
  percentage,
  loading = false,
  className = ''
}: DashboardCardProps) {
  const parsedPercentage = parsePercentage(percentage);
  const progressWidth = parsedPercentage === null ? 100 : parsedPercentage;
  const displayPercentage = typeof percentage === 'number' ? String(percentage) : percentage;

  return <GlassCard
    glowEffect={false}
    wrapperClassName={`dashboard-card-shell${className.includes('col-span-full') ? ' col-span-full' : ''}`}
    className={`dashboard-card ${statusClasses[status]} bg-white/40 backdrop-blur-xl backdrop-saturate-150 ring-1 ring-white/40 shadow-lg shadow-black/5 ${className}`.trim()}
  >
    <span className="dashboard-card-highlight bg-gradient-to-br from-white/50 via-transparent to-transparent" aria-hidden="true" />
    <div className="dashboard-card-top">
      <span className="dashboard-card-label">{label}</span>
      <span className="dashboard-card-icon rounded-full backdrop-blur-sm" aria-hidden="true">{icon}</span>
    </div>
    <div className="dashboard-card-value-row">
      <span className="dashboard-card-value">
        {loading ? <SkeletonBlock className="dashboard-stat-skeleton-value" /> : value}
      </span>
      {unit ? <span className="dashboard-card-unit">{' '}{unit}</span> : null}
    </div>
    <div className="dashboard-card-bottom">
      <span className="dashboard-card-sub-label">{subLabel}</span>
      {percentage !== undefined ? <span className="dashboard-card-percentage">
        {loading ? <SkeletonBlock className="dashboard-stat-skeleton-percent" /> : `${displayPercentage}%`}
      </span> : null}
    </div>
    <div className="dashboard-card-progress-track" aria-hidden="true">
      {loading ? <SkeletonBlock className="dashboard-stat-skeleton-progress" /> : <span className="dashboard-card-progress-fill" style={{ width: `${progressWidth}%` }} />}
    </div>
  </GlassCard>;
});

export default DashboardCard;
