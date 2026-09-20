// Copyright (C) 2026 Johandi Arifiansyach

import { useMemo, type ReactNode, type SVGAttributes } from 'react';
import type { DashboardStatsResponse, MonitoringStatus } from '../api/dashboardApi';
import type { PageState } from '../shared/pageState';
import DashboardCard from '../components/data-display/DashboardCard';

export type DashboardOverviewPageProps = {
  stats: DashboardStatsResponse;
  pageState?: PageState<DashboardStatsResponse>;
  loading?: boolean;
  /** A completed snapshot is shown while the backend refreshes it. */
  refreshing?: boolean;
  monitoringStatus?: MonitoringStatus | null;
  filterMonth: number;
  filterYear: number;
  ageGroup?: string;
  viewDesa?: string | null;
  viewPosyandu?: string | null;
};

type IconProps = SVGAttributes<SVGSVGElement>;

function Icon({ children, className = '', ...props }: IconProps & { children?: ReactNode }) {
  const hasAccessibleName = Boolean(props['aria-label'] || props['aria-labelledby']);
  return <svg {...props} className={`apple-symbol${className ? ` ${className}` : ''}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" focusable="false" {...(hasAccessibleName ? {} : { 'aria-hidden': true })}>{children}</svg>;
}

function ActivityIcon(props: IconProps) {
  return <Icon {...props}><path d="M2.5 12h4l2.35-7.3 4.3 14.6 2.35-7.3h6" /></Icon>;
}
function AlertTriangleIcon(props: IconProps) {
  return <Icon {...props}><path d="M10.35 4.25 2.7 18a2 2 0 0 0 1.75 3h15.1a2 2 0 0 0 1.75-3L13.65 4.25a1.9 1.9 0 0 0-3.3 0Z" /><path d="M12 9v4.4" /><circle cx="12" cy="17" r=".65" fill="currentColor" stroke="none" /></Icon>;
}
function BabyIcon(props: IconProps) {
  return <Icon {...props}><path d="M8.2 5.15A8.15 8.15 0 1 0 19.4 9.1" /><path d="M8.15 5.2c.55-2.15 3.85-2.9 5.15-1.05 1.1 1.55-.15 3.65-1.9 3.4-1.05-.15-1.55-1.15-1.15-2.05" /><circle cx="8.9" cy="12" r=".75" fill="currentColor" stroke="none" /><circle cx="15.1" cy="12" r=".75" fill="currentColor" stroke="none" /><path d="M9.3 16c1.55 1.2 3.85 1.2 5.4 0" /></Icon>;
}
function CircleOffIcon(props: IconProps) {
  return <Icon {...props}><circle cx="12" cy="12" r="9.25" /><path d="M5.45 5.45 18.55 18.55" /></Icon>;
}
function MinusIcon(props: IconProps) {
  return <Icon {...props}><path d="M5 12h14" /></Icon>;
}
function ScaleIcon(props: IconProps) {
  return <Icon {...props}><rect x="3" y="3.5" width="18" height="17.5" rx="4" /><path d="M7.25 10.25a4.75 4.75 0 0 1 9.5 0M12 10.25l2.55-2.15M7.5 17h9" /></Icon>;
}
function TrendingUpIcon(props: IconProps) {
  return <Icon {...props}><path d="m3.25 17.5 6.1-6.15 4.2 4.2 7.2-7.15" /><path d="M16.25 8.4h4.5v4.5" /></Icon>;
}
function UserPlusIcon(props: IconProps) {
  return <Icon {...props}><circle cx="9" cy="8" r="3.5" /><path d="M2.75 20c.35-3.65 2.65-6 6.25-6s5.9 2.35 6.25 6" /><circle cx="18" cy="9" r="3.25" /><path d="M18 7.35v3.3M16.35 9h3.3" /></Icon>;
}
function UsersIcon(props: IconProps) {
  return <Icon {...props}><circle cx="8.75" cy="8" r="3.25" /><path d="M2.5 19.75c.35-3.6 2.7-5.75 6.25-5.75S14.65 16.15 15 19.75" /><circle cx="16.75" cy="7.25" r="2.5" /><path d="M15.25 13.4c.5-.18 1-.27 1.55-.27 2.85 0 4.45 1.75 4.7 4.7" /></Icon>;
}

export default function DashboardOverviewPage({ stats: providedStats, pageState, loading = false, refreshing = false, monitoringStatus }: DashboardOverviewPageProps) {
  const resolvedState: PageState<DashboardStatsResponse> = pageState ?? (loading ? { status: 'loading' } : { status: 'success', data: providedStats });
  const pageLoading = resolvedState.status === 'loading';
  const pageError = resolvedState.status === 'error' ? resolvedState.message : null;
  const stats = resolvedState.status === 'success' ? resolvedState.data : providedStats;
  const snapshotStale = !pageLoading && Boolean(stats.snapshotStale);
  const isRefreshing = !pageLoading && (refreshing || Boolean(stats.analysisPending));
  const workerStatus = monitoringStatus?.worker?.status;
  const monitoringMessage = workerStatus === 'down'
    ? `Worker laporan tidak tersedia setelah ${monitoringStatus?.worker.consecutiveFailures || 3} pemeriksaan. Login dan input data tetap dapat digunakan.`
    : workerStatus === 'degraded' ? 'Worker laporan sedang lambat atau gagal diperiksa. Sistem akan memeriksa ulang otomatis.'
      : workerStatus === 'unconfigured' ? 'Alamat health check worker laporan belum dikonfigurasi.' : '';
  const storageStatus = monitoringStatus?.storage?.status;
  const storageMessage = storageStatus?.status === 'warning'
    ? 'Penyimpanan berkas mendekati batas 10 GB dan tidak dapat dibersihkan seluruhnya. Periksa lampiran permanen di R2.'
    : storageStatus?.status === 'cleaned' ? `${storageStatus.deletedObjects} file ekspor lama dibersihkan otomatis untuk menjaga kapasitas R2.` : '';
  const metricCardProps = useMemo(() => [
    { label: 'S (Sasaran)', value: stats.S, unit: 'balita', subLabel: 'Total balita aktif', icon: <UsersIcon />, status: 'neutral' as const },
    { label: 'D (Ditimbang)', value: stats.D, unit: 'balita', subLabel: 'Proporsi sasaran ditimbang', icon: <ScaleIcon />, status: 'good' as const, percentage: stats.perD },
    { label: 'N (Naik)', value: stats.N, unit: 'balita', subLabel: 'Pertumbuhan naik', icon: <TrendingUpIcon />, status: 'good' as const, percentage: stats.perN },
    { label: 'T (Tidak Naik)', value: stats.T, unit: 'balita', subLabel: 'Perlu pemantauan', icon: <MinusIcon />, status: 'warning' as const, percentage: stats.perT },
    { label: 'B (Bayi Baru)', value: stats.B, unit: 'balita', subLabel: 'Diinput bulan ini', icon: <UserPlusIcon />, status: 'neutral' as const },
    { label: 'O (Tidak Ditimbang)', value: stats.O ?? '-', unit: 'balita', subLabel: 'Bulan sebelumnya', icon: <CircleOffIcon />, status: 'risk' as const }
  ], [stats]);
  const prevalenceCards = useMemo(() => [
    { label: 'Underweight (BB/U)', value: stats.underweight, percentage: stats.perUnderweight, subLabel: 'Risiko berat badan kurang', icon: <AlertTriangleIcon />, status: 'risk' as const },
    { label: 'Stunting (TB/U)', value: stats.stunting, percentage: stats.perStunting, subLabel: 'Risiko tinggi badan pendek', icon: <AlertTriangleIcon />, status: 'risk' as const },
    { label: 'Wasting (BB/TB)', value: stats.wasting, percentage: stats.perWasting, subLabel: 'Risiko berat badan sangat kurang', icon: <AlertTriangleIcon />, status: 'risk' as const }
  ], [stats]);
  return <div className="apple-page dashboard-overview-surface space-y-6 bg-white/30 backdrop-blur-sm" aria-busy={pageLoading ? 'true' : 'false'}>
    <div className="apple-page-header flex items-end justify-between"><h2 className="apple-section-title dashboard-overview-title">Capaian Program SKDN</h2>{pageLoading || isRefreshing ? <ActivityIcon className="h-5 w-5 animate-spin text-emerald-600" aria-label={pageLoading ? 'Memuat ringkasan' : 'Memperbarui ringkasan'} /> : null}</div>
    {pageError ? <div role="alert" className="ios-inline-notification ios-inline-notification-error system-health-notice">{pageError}</div> : null}
    {snapshotStale && !pageError ? <div role="status" aria-live="polite" className="ios-inline-notification ios-inline-notification-warning system-health-notice">Menampilkan snapshot dashboard terakhir. Data akan disegarkan setelah API aktif kembali.</div> : null}
    {monitoringMessage ? <div role="status" aria-live="polite" className={`ios-inline-notification ${workerStatus === 'down' ? 'ios-inline-notification-error' : 'ios-inline-notification-warning'} system-health-notice flex items-start gap-3`}><AlertTriangleIcon className="h-5 w-5 flex-shrink-0" /><div><p className="font-bold">Status pemrosesan laporan</p><p className="mt-1">{monitoringMessage}</p></div></div> : null}
    {storageMessage ? <div role="status" aria-live="polite" className={`ios-inline-notification ${storageStatus?.status === 'warning' ? 'ios-inline-notification-error' : 'ios-inline-notification-warning'} system-health-notice flex items-start gap-3`}><AlertTriangleIcon className="h-5 w-5 flex-shrink-0" /><div><p className="font-bold">Kapasitas penyimpanan ekspor</p><p className="mt-1">{storageMessage}</p></div></div> : null}
    <div className="apple-metrics-grid dashboard-skdn-grid grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">{metricCardProps.map((item) => <DashboardCard {...item} loading={pageLoading} key={item.label} />)}</div>
    <h2 className="apple-section-title mt-6">Capaian ASI Eksklusif</h2>
    <div className="dashboard-asi-grid grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3"><DashboardCard label="ASI Eksklusif" value={`${stats.asiEksklusif} / ${stats.asiTarget}`} unit="bayi" subLabel="Bayi usia 6 bulan" icon={<BabyIcon />} status="good" percentage={stats.perAsiEksklusif} loading={pageLoading} className="dashboard-card--feature col-span-full" /></div>
    <h2 className="apple-section-title mt-6">Prevalensi Status Gizi</h2>
    <div className="dashboard-prevalence-grid grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">{prevalenceCards.map((item) => <DashboardCard {...item} unit="balita" loading={pageLoading} key={item.label} />)}</div>
  </div>;
}
