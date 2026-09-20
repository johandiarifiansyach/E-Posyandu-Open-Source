// Copyright (C) 2026 Johandi Arifiansyach
// SPDX-License-Identifier: GPL-3.0-or-later

import { motion, useReducedMotion } from "framer-motion";
import { ChevronRight, type LucideIcon } from "lucide-react";
import type { DashboardStatsResponse } from "../api/dashboardApi";
import { SIDEBAR_NAV_SECTIONS } from "../components/navigation/Sidebar";
import { GlassScrollArea } from "../components/glass-scroll-area";
import type { PageState } from "../shared/pageState";

export type AnalysisCategoryId =
  | "underweight"
  | "stunting"
  | "wasting"
  | "tidak_naik"
  | "pmt";

export type AnalysisNavigationView =
  | "problem_underweight"
  | "problem_stunting"
  | "problem_wasting"
  | "problem_tidak_naik"
  | "pmt";

type AnalysisMenuItem = {
  id: AnalysisCategoryId;
  view: AnalysisNavigationView;
  label: string;
  description: string;
  Icon: LucideIcon;
  count?: number;
  accent: string;
};

const ANALYSIS_MENU_DESCRIPTIONS: Record<AnalysisNavigationView, string> = {
  problem_underweight: "Daftar balita dengan status berat badan kurang (BB/U).",
  problem_stunting: "Daftar balita dengan risiko tinggi badan pendek (TB/U).",
  problem_wasting: "Daftar balita dengan status berat badan sangat kurang (BB/TB).",
  problem_tidak_naik: "Balita yang memerlukan pemantauan pertumbuhan lanjutan.",
  pmt: "Kelola program makanan tambahan dan penerima intervensi.",
};

const ANALYSIS_MENU_META: Record<AnalysisNavigationView, {
  id: AnalysisCategoryId;
  accent: string;
}> = {
  problem_underweight: { id: "underweight", accent: "bg-white/55 text-slate-600 ring-1 ring-white/60" },
  problem_stunting: { id: "stunting", accent: "bg-white/55 text-slate-600 ring-1 ring-white/60" },
  problem_wasting: { id: "wasting", accent: "bg-white/55 text-slate-600 ring-1 ring-white/60" },
  problem_tidak_naik: { id: "tidak_naik", accent: "bg-white/55 text-slate-600 ring-1 ring-white/60" },
  pmt: { id: "pmt", accent: "bg-white/55 text-slate-600 ring-1 ring-white/60" },
};

export type AnalisisGiziPageProps = {
  stats: DashboardStatsResponse;
  pageState?: PageState<DashboardStatsResponse>;
  loading?: boolean;
  refreshing?: boolean;
  onNavigate?: (view: AnalysisNavigationView) => void;
};

function menuItems(stats: DashboardStatsResponse): AnalysisMenuItem[] {
  const analysisSection = SIDEBAR_NAV_SECTIONS.find((section) => section.id === "analysis");
  return (analysisSection?.items || []).map((item) => {
    const view = item.view as AnalysisNavigationView;
    const meta = ANALYSIS_MENU_META[view];
    const count = view === "problem_underweight"
      ? stats.underweight
      : view === "problem_stunting"
        ? stats.stunting
        : view === "problem_wasting"
          ? stats.wasting
          : view === "problem_tidak_naik"
            ? stats.T
            : undefined;
    return {
      id: meta.id,
      view,
      label: item.label,
      description: ANALYSIS_MENU_DESCRIPTIONS[view],
      Icon: item.Icon,
      count,
      accent: meta.accent,
    };
  });
}

/** Deterministic nutrition-status hub; no machine-learning prediction is used. */
export default function AnalisisGizi({
  stats: providedStats,
  pageState,
  loading = false,
  refreshing = false,
  onNavigate,
}: AnalisisGiziPageProps) {
  const reducedMotion = useReducedMotion();
  const resolvedState = pageState ?? (loading
    ? { status: "loading" as const }
    : { status: "success" as const, data: providedStats });
  const pageLoading = resolvedState.status === "loading";
  const pageError = resolvedState.status === "error" ? resolvedState.message : null;
  const stats = resolvedState.status === "success" ? resolvedState.data : providedStats;
  const items = menuItems(stats);
  const spring = reducedMotion
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 430, damping: 30, mass: 0.7 };

  return (
    <div className="apple-page analysis-page space-y-5" aria-busy={pageLoading ? "true" : "false"}>
      <header className="apple-page-header flex items-end justify-between gap-4">
        <div>
          <h2 className="apple-page-title">Analisis Gizi</h2>
          <p className="mt-1 text-sm text-slate-500">
            Pilih menu untuk melihat daftar dan tindak lanjut status gizi balita.
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Status dihitung secara deterministik berdasarkan data pengukuran dan standar WHO.
          </p>
        </div>
        {refreshing || Boolean(stats.analysisPending) ? (
          <span className="text-xs font-medium text-slate-400" role="status">Memperbarui…</span>
        ) : null}
      </header>

      {pageError ? (
        <div className="ios-inline-notification ios-inline-notification-error" role="alert">
          {pageError}
        </div>
      ) : null}

      <section className="relative">
        <GlassScrollArea className="analysis-mobile-scroll-area h-[60vh] min-h-[20rem] max-h-[32rem] md:h-auto md:min-h-0 md:max-h-none">
          <div className="analysis-menu-list flex flex-col gap-3 px-1 pb-1">
            {items.map((item) => (
              <motion.button
                key={item.id}
                type="button"
                onClick={() => onNavigate?.(item.view)}
                whileHover={reducedMotion ? undefined : { x: 3 }}
                whileTap={reducedMotion ? undefined : { scale: 0.985 }}
                transition={spring}
                className="analysis-menu-card group relative flex w-full items-center gap-3 overflow-hidden rounded-[22px] border border-white/45 bg-white/55 px-4 py-4 text-left shadow-lg shadow-slate-900/5 ring-1 ring-white/30 backdrop-blur-xl transition-colors hover:bg-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              >
                <span className="pointer-events-none absolute inset-x-0 top-0 h-12 bg-gradient-to-br from-white/45 via-transparent to-transparent" aria-hidden="true" />
                <span className="relative z-[1] flex h-11 w-11 shrink-0 items-center justify-center rounded-full backdrop-blur-sm">
                  <span className={`flex h-full w-full items-center justify-center rounded-full ${item.accent}`}>
                    <item.Icon className="h-5 w-5" strokeWidth={2.1} />
                  </span>
                </span>
                <span className="relative z-[1] min-w-0 flex-1">
                  <span className="block text-sm font-bold text-slate-800">{item.label}</span>
                  <span className="mt-0.5 block text-xs leading-5 text-slate-500">{item.description}</span>
                </span>
                {item.count !== undefined ? (
                  <span className="relative z-[1] shrink-0 rounded-full bg-blue-500/10 px-2.5 py-1 text-xs font-bold tabular-nums text-blue-600">
                    {item.count}
                  </span>
                ) : null}
                <ChevronRight className="relative z-[1] h-5 w-5 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5" />
              </motion.button>
            ))}
          </div>
        </GlassScrollArea>
      </section>
    </div>
  );
}
