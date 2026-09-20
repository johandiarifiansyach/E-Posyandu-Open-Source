// Copyright (C) 2026 Johandi Arifiansyach
// SPDX-License-Identifier: GPL-3.0-or-later

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ChartLine,
  Ellipsis,
  LayoutDashboard,
  Plus,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  SIDEBAR_NAV_SECTIONS,
  type SidebarNavItemConfig,
  type SidebarNavSectionConfig,
} from "./Sidebar";
import FluidGlassSurface from "../ui/FluidGlassSurface";

export type MobileBottomNavProps<T extends string = string> = {
  activeView: T;
  onNavigate: (view: T) => void;
  canWrite?: boolean;
  sidebarOpen?: boolean;
};

type MobileTab = {
  id: "dashboard" | "data" | "addChild" | "analysis" | "more";
  label: string;
  Icon: LucideIcon;
};

const MOBILE_TABS: MobileTab[] = [
  { id: "dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { id: "data", label: "Data Balita", Icon: Users },
  { id: "addChild", label: "Tambah", Icon: Plus },
  { id: "analysis", label: "Analisis Gizi", Icon: ChartLine },
  { id: "more", label: "Lainnya", Icon: Ellipsis },
];

const PRIMARY_VIEW_IDS = new Set(["dashboard", "data_balita", "add_child"]);
const ANALYSIS_VIEW_IDS = new Set([
  "problem_underweight",
  "problem_stunting",
  "problem_wasting",
  "problem_tidak_naik",
  "pmt_program",
]);

function tabForView(view: string): MobileTab["id"] {
  if (view === "dashboard") return "dashboard";
  if (view === "data") return "data";
  if (view === "addChild") return "addChild";
  if (view === "analysis" || ANALYSIS_VIEW_IDS.has(view) || view === "pmt") return "analysis";
  return "more";
}

function moreSections() {
  return SIDEBAR_NAV_SECTIONS.map((section) => ({
    ...section,
    // The dock owns the dashboard, child list, quick-add action, and nutrition
    // analysis group. Keep the More sheet for the remaining pages.
    items: section.items.filter(
      (item) => !PRIMARY_VIEW_IDS.has(item.id) && !ANALYSIS_VIEW_IDS.has(item.id),
    ),
  })).filter((section) => section.items.length > 0);
}

function MoreMenuItem<T extends string>({
  item,
  activeView,
  onNavigate,
  onClose,
}: {
  item: SidebarNavItemConfig<string>;
  activeView: T;
  onNavigate: (view: T) => void;
  onClose: () => void;
}) {
  const active = String(activeView) === item.view;
  const { Icon } = item;
  return (
    <motion.button
      type="button"
      role="menuitem"
      aria-current={active ? "page" : undefined}
      onClick={() => {
        onNavigate(item.view as T);
        onClose();
      }}
      whileTap={{ scale: 0.97 }}
      className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm transition-colors ${
        active
          ? "bg-blue-500/10 font-semibold text-blue-600"
          : "text-slate-600 hover:bg-white/40"
      }`}
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl backdrop-blur-sm ${
          active ? "bg-blue-500/10 text-blue-600" : "bg-white/30 text-slate-500"
        }`}
      >
        <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.25 : 1.9} />
      </span>
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
    </motion.button>
  );
}

/**
 * Mobile-only navigation dock. The fifth tab opens the complete desktop menu
 * in a bottom sheet so feature pages remain discoverable without shrinking
 * the five primary actions.
 */
export default function MobileBottomNav<T extends string = string>({
  activeView,
  onNavigate,
  canWrite = true,
  sidebarOpen = false,
}: MobileBottomNavProps<T>) {
  const [moreOpen, setMoreOpen] = useState(false);
  const reducedMotion = useReducedMotion();
  const activeTab = tabForView(String(activeView));
  const sections = moreSections();
  const spring = reducedMotion
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 440, damping: 28, mass: 0.64 };

  useEffect(() => {
    if (sidebarOpen) setMoreOpen(false);
  }, [sidebarOpen]);

  const navigateFromTab = (tab: MobileTab["id"]) => {
    if (tab === "more") {
      setMoreOpen(true);
      return;
    }
    if (tab === "addChild" && !canWrite) return;
    const view = tab === "dashboard"
      ? "dashboard"
      : tab === "data"
        ? "data"
        : tab === "addChild"
          ? "addChild"
          : tab === "analysis"
            ? "analysis"
            : "more";
    onNavigate(view as T);
  };

  const renderTab = ({ id, label, Icon }: MobileTab) => {
    const active = activeTab === id;
    const isCta = id === "addChild";
    return (
      <motion.button
        type="button"
        key={id}
        aria-current={active ? "page" : undefined}
        aria-label={label}
        aria-disabled={isCta && !canWrite ? true : undefined}
        disabled={isCta && !canWrite}
        onClick={() => navigateFromTab(id)}
        whileTap={reducedMotion || (isCta && !canWrite) ? undefined : { scale: 0.9 }}
        animate={{ scale: active ? 1.04 : 1 }}
        transition={spring}
        className={`group relative z-10 flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-full py-1.5 text-[10px] font-medium transition-colors active:scale-90 ${
          active
            ? "text-blue-600"
            : "text-slate-900 hover:text-black"
        } disabled:cursor-not-allowed disabled:opacity-50`}
      >
        <span className="relative flex min-w-0 flex-col items-center justify-center rounded-full px-3 py-1">
          {active ? (
            <motion.span
              layoutId="mobile-bottom-nav-active-blob"
              transition={spring}
              className="absolute inset-0 z-0 rounded-full border border-white/40 bg-gradient-to-b from-white/36 via-white/20 to-white/8 shadow-inner backdrop-blur-sm supports-[backdrop-filter:blur(1px)]:backdrop-blur-xl supports-[backdrop-filter:blur(1px)]:backdrop-saturate-150"
              aria-hidden="true"
            />
          ) : null}
          <span className="relative z-10 flex h-7 w-9 items-center justify-center">
            <Icon className="h-[19px] w-[19px]" strokeWidth={active ? 2.35 : 1.85} />
          </span>
          <span className="mobile-tab-label relative z-10 block max-w-full truncate px-0.5">
            {label}
          </span>
        </span>
      </motion.button>
    );
  };

  const navigationItems = MOBILE_TABS.map(renderTab);

  return (
    <>
      <AnimatePresence>
        {moreOpen ? (
          <motion.div
            className="fixed inset-0 z-[60] md:hidden"
            initial={reducedMotion ? undefined : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reducedMotion ? undefined : { opacity: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.16 }}
          >
            <button
              type="button"
              className="absolute inset-0 h-full w-full bg-black/10 backdrop-blur-sm"
              aria-label="Tutup menu lainnya"
              onClick={() => setMoreOpen(false)}
            />
            <motion.section
              role="dialog"
              aria-modal="true"
              aria-labelledby="mobile-more-title"
              className="absolute inset-x-0 bottom-0 max-h-[82dvh] overflow-y-auto rounded-t-[32px] border border-white/30 bg-white/70 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl shadow-slate-900/20 backdrop-blur-2xl backdrop-saturate-150"
              initial={reducedMotion ? undefined : { y: "100%" }}
              animate={{ y: 0 }}
              exit={reducedMotion ? undefined : { y: "100%" }}
              transition={spring}
            >
              <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-slate-300/70" aria-hidden="true" />
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Navigasi</p>
                  <h2 id="mobile-more-title" className="mt-1 text-lg font-bold text-slate-800">Menu lainnya</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setMoreOpen(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white/50 text-slate-500 ring-1 ring-white/30 transition hover:bg-white/80"
                  aria-label="Tutup menu lainnya"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-4" role="menu">
                {sections.map((section: SidebarNavSectionConfig<string>) => (
                  <section key={section.id}>
                    <h3 className="mb-2 border-b border-white/30 pb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                      {section.label}
                    </h3>
                    <div className="grid gap-1 sm:grid-cols-2">
                      {section.items.map((item) => (
                        <MoreMenuItem
                          key={item.id}
                          item={item}
                          activeView={activeView}
                          onNavigate={onNavigate}
                          onClose={() => setMoreOpen(false)}
                        />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </motion.section>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {!sidebarOpen ? (
        <nav
          className="fixed bottom-4 left-1/2 right-auto z-50 h-16 w-[calc(100%-2rem)] max-w-[520px] -translate-x-1/2 pb-[env(safe-area-inset-bottom)] md:hidden"
          aria-label="Navigasi mobile"
        >
          <div className="mobile-bottom-nav-host relative h-full w-full overflow-visible rounded-full">
            <FluidGlassSurface
              className="mobile-bottom-nav-surface rounded-full border border-white/35 shadow-[0_18px_42px_rgba(15,23,42,0.16),inset_0_1px_0_rgba(255,255,255,0.82)] ring-1 ring-white/45"
              radius={999}
              mode="bar"
            />
            <div className="mobile-bottom-nav-content-layer relative z-10 flex h-full w-full items-center justify-between gap-1 overflow-visible rounded-full px-4 py-2">
              {navigationItems}
            </div>
          </div>
        </nav>
      ) : null}
    </>
  );
}
