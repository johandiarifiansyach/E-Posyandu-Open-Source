// Copyright (C) 2026 Johandi Arifiansyach

import { Fragment, type FocusEvent, type MouseEvent } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Baby,
  ChevronLeft,
  ChevronRight,
  Clock,
  Gift,
  History,
  LayoutDashboard,
  Plus,
  Trash2,
  Utensils,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import FluidGlassSurface from "../ui/FluidGlassSurface";

export type SidebarNavItemConfig<T extends string = string> = {
  view: T;
  id: string;
  label: string;
  Icon: LucideIcon;
};

export type SidebarNavSectionConfig<T extends string = string> = {
  id: string;
  label: string;
  items: SidebarNavItemConfig<T>[];
};

/**
 * Canonical navigation map shared by the desktop sidebar and the mobile
 * bottom navigation. Keep route ids here so labels/icons do not drift between
 * breakpoints.
 */
export const SIDEBAR_NAV_SECTIONS: SidebarNavSectionConfig<string>[] = [
  {
    id: "main",
    label: "Menu Utama",
    items: [
      { view: "dashboard", id: "dashboard", label: "Dashboard", Icon: LayoutDashboard },
      { view: "data", id: "data_balita", label: "Data Balita", Icon: Users },
      { view: "asi", id: "asi_eksklusif", label: "ASI Eksklusif", Icon: Baby },
      { view: "mpasi", id: "mpasi", label: "MPASI (6-23 Bln)", Icon: Utensils },
    ],
  },
  {
    id: "management",
    label: "Manajemen Data",
    items: [
      { view: "addChild", id: "add_child", label: "Tambah Balita", Icon: Plus },
      { view: "recent", id: "recent", label: "Balita Baru Diinput", Icon: Clock },
      { view: "history", id: "change_history", label: "Riwayat Perubahan", Icon: History },
      { view: "recycle", id: "recycle_bin", label: "Daftar Dihapus", Icon: Trash2 },
      { view: "pmt", id: "pmt_program", label: "Pemberian PMT", Icon: Gift },
    ],
  },
];

const DEFAULT_NAV_SECTIONS = SIDEBAR_NAV_SECTIONS;

export type SidebarProps<T extends string> = {
  activeView: T;
  onNavigate: (view: T) => void;
  canWrite: boolean;
  collapsed: boolean;
  sidebarOpen: boolean;
  onClose: () => void;
  onToggle: () => void;
  onShowTooltip: (
    label: string,
    event: MouseEvent<HTMLButtonElement> | FocusEvent<HTMLButtonElement>,
  ) => void;
  onHideTooltip: () => void;
  sections?: SidebarNavSectionConfig<T>[];
};

/**
 * Floating liquid-glass navigation rail. The active blob is shared with
 * Framer Motion's layoutId so it glides between routes without remounting the
 * whole sidebar.
 */
export default function Sidebar<T extends string>({
  activeView,
  onNavigate,
  canWrite,
  collapsed,
  sidebarOpen,
  onClose,
  onToggle,
  onShowTooltip,
  onHideTooltip,
  sections = DEFAULT_NAV_SECTIONS as SidebarNavSectionConfig<T>[],
}: SidebarProps<T>) {
  const reducedMotion = useReducedMotion();
  const sidebarSpring = reducedMotion
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 460, damping: 28, mass: 0.62 };

  const renderItem = (config: SidebarNavItemConfig<T>) => {
    const { view, id, label, Icon } = config;
    const active = activeView === view;
    return (
      <motion.button
        type="button"
        key={id}
        data-nav-id={id}
        data-tooltip={label}
        aria-current={active ? "page" : undefined}
        aria-label={label}
        onMouseEnter={(event) => onShowTooltip(label, event)}
        onMouseLeave={onHideTooltip}
        onFocus={(event) => onShowTooltip(label, event)}
        onBlur={onHideTooltip}
        onClick={() => {
          onHideTooltip();
          onNavigate(view);
          onClose();
        }}
        animate={{ scale: active && !reducedMotion ? 1.025 : 1 }}
        whileHover={reducedMotion || active ? undefined : { scale: 1.015 }}
        whileTap={reducedMotion ? undefined : { scale: 0.97 }}
        transition={sidebarSpring}
        className={`sidebar-nav-item group ${active ? "is-active" : ""}`}
      >
        {active ? (
          <motion.span
            layoutId="sidebar-active-blob"
            transition={sidebarSpring}
            className="sidebar-active-blob"
            aria-hidden="true"
          />
        ) : null}
        <div className="sidebar-nav-content flex items-center gap-3">
          <span
            className={`sidebar-nav-icon ${active ? "sidebar-nav-icon-active" : ""}`}
            aria-hidden="true"
          >
            <Icon
              className="h-5 w-5"
              strokeWidth={active ? 2.35 : 1.8}
              fill={active ? "currentColor" : "none"}
              fillOpacity={active ? 0.18 : 0}
            />
          </span>
          <span
            className={`sidebar-nav-label text-left text-sm ${active ? "sidebar-nav-label-active" : ""}`}
          >
            {label}
          </span>
        </div>
      </motion.button>
    );
  };

  const collapseButton = (
    <button
      type="button"
      className="sidebar-collapse-button hidden md:flex"
      title={collapsed ? "Perluas Menu" : "Ringkas Menu"}
      onClick={onToggle}
      onMouseEnter={(event) =>
        onShowTooltip(collapsed ? "Perluas Menu" : "Ringkas Menu", event)
      }
      onMouseLeave={onHideTooltip}
      onFocus={(event) =>
        onShowTooltip(collapsed ? "Perluas Menu" : "Ringkas Menu", event)
      }
      onBlur={onHideTooltip}
      aria-label={collapsed ? "Perluas Menu" : "Ringkas Menu"}
      aria-expanded={!collapsed}
    >
      <span className="sidebar-nav-icon sidebar-collapse-symbol">
        <ChevronRight className="sidebar-expand-icon h-5 w-5" />
        <ChevronLeft className="sidebar-collapse-icon h-5 w-5" />
      </span>
      <span className="sidebar-nav-label text-left text-sm">
        <span className="sidebar-expand-label">Perluas Menu</span>
        <span className="sidebar-collapse-label">Ringkas Menu</span>
      </span>
    </button>
  );

  const navContent = (
    <>
      {collapseButton}
      {sections.map((section, sectionIndex) => (
        <Fragment key={section.id}>
          <p className="sidebar-section-label">{section.label}</p>
          {section.items
            .filter((itemConfig) => itemConfig.view !== ("addChild" as T) || canWrite)
            .map(renderItem)}
          {sectionIndex < sections.length - 1 ? (
            <div
              className={`sidebar-nav-spacer ${sectionIndex === 0 ? "sidebar-nav-spacer-small" : ""}`}
              aria-hidden="true"
            />
          ) : null}
        </Fragment>
      ))}
    </>
  );

  return (
    <>
      {sidebarOpen ? (
        <div
          className="sidebar-scrim fixed inset-0 z-40 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      ) : null}
      <button
        type="button"
        className="sidebar-expanded-dismiss"
        onClick={onToggle}
        aria-label="Ringkas menu samping"
      />
      <aside
        className={`app-sidebar fluid-sidebar-host liquid-sidebar-host fixed top-0 z-50 hidden h-screen flex-col md:sticky md:flex ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
        data-sidebar-state={collapsed ? "collapsed" : "expanded"}
        aria-label="Navigasi utama"
      >
        <div className="sidebar-mobile-toolbar md:hidden">
          <span>Daftar Menu</span>
          <button
            type="button"
            onClick={onClose}
            title="Tutup menu"
            aria-label="Tutup menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav
          className="app-sidebar-nav fluid-sidebar-nav-host liquid-sidebar-nav-host relative min-h-0 flex-1 overflow-hidden"
        >
          <FluidGlassSurface
            className="sidebar-liquid-surface fluid-sidebar-surface rounded-[28px] border border-white/35 shadow-[0_20px_48px_rgba(15,23,42,0.12),inset_0_1px_0_rgba(255,255,255,0.72)] ring-1 ring-white/35"
            radius={28}
            mode="bar"
          />
          <div className="sidebar-nav-layer relative z-10 flex h-full min-h-0 flex-col space-y-1 overflow-y-auto px-3 py-4">
            {navContent}
          </div>
        </nav>
      </aside>
      <div
        id="react-sidebar-tooltip"
        className="sidebar-dock-tooltip"
        role="tooltip"
        aria-hidden="true"
      />
    </>
  );
}
