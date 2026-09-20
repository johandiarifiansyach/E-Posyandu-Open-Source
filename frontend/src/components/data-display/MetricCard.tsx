// SPDX-License-Identifier: GPL-3.0-or-later


import { memo, type ReactNode } from 'react';
import DashboardCard, { type DashboardCardStatus } from './DashboardCard';

export type MetricCardProps = {
  label: string;
  value: number | string;
  loading?: boolean;
  icon?: ReactNode;
  className?: string;
  progress?: string;
  progressColor?: string;
  progressTextColor?: string;
  subtitle?: string;
};

function statusFromLegacyClasses(className: string, progressColor: string): DashboardCardStatus {
  const token = `${className} ${progressColor}`.toLowerCase();
  if (token.includes('red') || token.includes('rose')) return 'risk';
  if (token.includes('orange') || token.includes('amber') || token.includes('yellow')) return 'warning';
  if (token.includes('green') || token.includes('emerald')) return 'good';
  return 'neutral';
}

/** Compatibility adapter that keeps legacy callers on the shared card UI. */
const MetricCard = memo(function MetricCard({ label, value, loading = false, icon, className = '', progress, progressColor = '', subtitle }: MetricCardProps) {
  return <DashboardCard
    label={label}
    value={value}
    subLabel={subtitle}
    icon={icon ?? <span aria-hidden="true" />}
    status={statusFromLegacyClasses(className, progressColor)}
    percentage={progress}
    loading={loading}
    className={className}
  />;
});

export default MetricCard;
