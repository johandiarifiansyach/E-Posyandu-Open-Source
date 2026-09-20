// Copyright (C) 2026 Johandi Arifiansyach

import { memo, type ReactNode } from 'react';

type BadgeColor = 'emerald' | 'blue' | 'pink' | 'slate' | 'amber';

export const Badge = memo(function Badge({ children, color = 'emerald' }: { children?: ReactNode; color?: BadgeColor }) {
  const colors: Record<BadgeColor, string> = {
    emerald: 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200',
    blue: 'bg-blue-100 text-blue-700 ring-1 ring-blue-200',
    pink: 'bg-pink-100 text-pink-700 ring-1 ring-pink-200',
    slate: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
    amber: 'bg-amber-100 text-amber-700 ring-1 ring-amber-200'
  };
  return <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold ${colors[color]}`}>{children}</span>;
});

export const KenaikanBadge = memo(function KenaikanBadge({ status }: { status?: string | null }) {
  if (!status) return <span className="text-slate-300">-</span>;
  const labels: Record<string, [string, string]> = {
    N: ['N (Naik)', 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200'],
    T: ['T (Tidak Naik)', 'bg-rose-100 text-rose-700 ring-1 ring-rose-200'],
    B: ['B (Baru)', 'bg-blue-100 text-blue-700 ring-1 ring-blue-200'],
    O: ['O (Tidak Hadir)', 'bg-slate-100 text-slate-600 ring-1 ring-slate-200']
  };
  const [label, color] = labels[status] || [status, 'bg-slate-100 text-slate-700'];
  return <span className={`ios-status-pill whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold ${color}`}>{label}</span>;
});

/**
 * Canonical status-gizi tone used by both the desktop table badge and the
 * compact mobile child cards. Keeping the classification here prevents the
 * two breakpoints from drifting into different semantic colours.
 */
export type StatusBadgeTone = 'empty' | 'severe' | 'risk' | 'good' | 'risk-more' | 'more' | 'high' | 'neutral';

export function statusBadgeTone(status?: string | null): StatusBadgeTone {
  if (status === '-' || !status) return 'empty';
  const key = String(status).trim().toLowerCase();
  if (['berat sangat kurang', 'berat badan sangat kurang', 'sangat pendek', 'gizi buruk'].includes(key)) return 'severe';
  if (['berat kurang', 'berat badan kurang', 'pendek', 'gizi kurang', 'mikrosefali', 'mikrosefali berat', 'lila rendah', 'lila sangat rendah'].includes(key)) return 'risk';
  if (['berat normal', 'berat badan normal', 'normal', 'gizi baik', 'lila normal'].includes(key)) return 'good';
  if (['risiko berat lebih', 'risiko berat badan lebih', 'risiko gizi lebih'].includes(key)) return 'risk-more';
  if (['gizi lebih', 'lila tinggi', 'makrosefali'].includes(key)) return 'more';
  if (['tinggi', 'obesitas'].includes(key)) return 'high';
  return 'neutral';
}

export const StatusBadge = memo(function StatusBadge({ status }: { status?: string | null }) {
  const tone = statusBadgeTone(status);
  if (tone === 'empty') return <span className="text-slate-300">-</span>;
  const colors: Record<Exclude<StatusBadgeTone, 'empty'>, string> = {
    severe: 'bg-black text-white ring-1 ring-black',
    risk: 'bg-red-100 text-red-700 ring-1 ring-red-200',
    good: 'bg-green-100 text-green-700 ring-1 ring-green-200',
    'risk-more': 'bg-teal-100 text-teal-700 ring-1 ring-teal-200',
    more: 'bg-sky-100 text-sky-700 ring-1 ring-sky-200',
    high: 'bg-blue-900 text-white ring-1 ring-blue-900',
    neutral: 'bg-slate-100 text-slate-700',
  };
  const color = colors[tone];
  return <span className={`ios-status-pill whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold ${color}`}>{status}</span>;
});
