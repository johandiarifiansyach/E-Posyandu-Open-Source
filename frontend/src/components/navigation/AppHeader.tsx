// Copyright (C) 2026 Johandi Arifiansyach

import { useEffect, useState, type RefObject } from "react";
import { Activity, ChevronDown, LogOut, UserRound } from "lucide-react";
import { APP_VERSION } from "../../config/app";
import { ROLES } from "../../config/dashboard";
import { formatChildName } from "../../shared/formatters";
import type { DashboardUser } from "../../types";
import { GlassAvatar, GlassAvatarFallback } from "../ui/glass-avatar";
import FluidGlassSurface from "../ui/FluidGlassSurface";

export type AppHeaderProps = {
  user: DashboardUser;
  accountOpen: boolean;
  onToggleAccount: () => void;
  onLogout: () => Promise<void>;
  onOpenAdmin: () => void;
  accountRef: RefObject<HTMLDivElement | null>;
};

function accountDetails(user: DashboardUser) {
  if (user.role === ROLES.SUPER_ADMIN) {
    return { name: "Administrator", description: "Puskesmas Demo" };
  }
  if (user.role === ROLES.KADER) {
    return {
      name: `Posyandu ${formatChildName(user.posyandu || "")}`.trim(),
      description: user.desa || "Desa",
    };
  }
  if (user.role === ROLES.BIDAN) {
    return { name: user.desa || "Desa", description: "Bidan Desa" };
  }
  return { name: "Ahli Gizi", description: "Puskesmas Demo" };
}

function accountRoleLabel(user: DashboardUser) {
  return user.role === ROLES.SUPER_ADMIN ? "Administrator" : user.role;
}

/**
 * Stable application chrome shared by every authenticated page.
 * The header owns product identity while page context is rendered by the
 * content area, keeping the top bar focused on account and application
 * controls.
 */
export default function AppHeader({
  user,
  accountOpen,
  onToggleAccount,
  onLogout,
  onOpenAdmin,
  accountRef,
}: AppHeaderProps) {
  const account = accountDetails(user);
  const [mobileHeaderHidden, setMobileHeaderHidden] = useState(false);

  useEffect(() => {
    const mobileQuery = window.matchMedia?.("(max-width: 767px)");
    if (!mobileQuery) return;

    let lastScrollY = Math.max(0, window.scrollY);
    let frame = 0;

    const updateVisibility = () => {
      frame = 0;
      const currentScrollY = Math.max(0, window.scrollY);

      // The same header can be resized from desktop to mobile without being
      // remounted. Keep the desktop chrome untouched in that case.
      if (!mobileQuery.matches) {
        setMobileHeaderHidden(false);
        lastScrollY = currentScrollY;
        return;
      }

      const delta = currentScrollY - lastScrollY;

      // Always reveal the chrome at the top of the page. A small threshold
      // keeps the header from flickering while a touch scroll settles.
      if (currentScrollY <= 10) {
        setMobileHeaderHidden(false);
      } else if (delta > 3) {
        setMobileHeaderHidden(true);
      } else if (delta < -3) {
        setMobileHeaderHidden(false);
      }
      lastScrollY = currentScrollY;
    };

    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(updateVisibility);
    };

    const onViewportChange = (event: MediaQueryListEvent) => {
      if (!event.matches) setMobileHeaderHidden(false);
      lastScrollY = Math.max(0, window.scrollY);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    if (mobileQuery.addEventListener) {
      mobileQuery.addEventListener("change", onViewportChange);
    } else {
      mobileQuery.addListener(onViewportChange);
    }

    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
      if (mobileQuery.removeEventListener) {
        mobileQuery.removeEventListener("change", onViewportChange);
      } else {
        mobileQuery.removeListener(onViewportChange);
      }
    };
  }, []);

  const headerContent = (
    <>
      <div className="app-header-title app-header-brand flex min-w-0 items-center gap-3">
        <span className="topbar-brand-logo-shell" aria-hidden="true">
          <img
            src="/logo-puskesmas-32981.svg"
            alt=""
            className="h-9 w-9"
            width={36}
            height={36}
            loading="lazy"
            decoding="async"
          />
        </span>
        <div className="topbar-brand-copy min-w-0">
          <div className="topbar-brand-name-row">
            <h1 className="truncate">E-Posyandu</h1>
            <span className="topbar-version-badge">v{APP_VERSION}</span>
          </div>
          <p>Puskesmas Demo</p>
        </div>
      </div>

      <div className="topbar-actions">
        <div ref={accountRef} className="account-wrapper relative">
          <button
            type="button"
            className="account-trigger glass-control"
            onClick={onToggleAccount}
            aria-haspopup="menu"
            aria-expanded={accountOpen}
            aria-controls="react-account-dropdown"
            title="Buka menu akun"
          >
            <GlassAvatar className="account-avatar" glowEffect={false} aria-hidden="true">
              <GlassAvatarFallback>{account.name.charAt(0)}</GlassAvatarFallback>
            </GlassAvatar>
            <span className="account-trigger-copy min-w-0 text-left">
              <span className="block truncate text-sm font-bold text-slate-800">
                {account.name}
              </span>
              <span className="block truncate text-[11px] text-slate-500">
                {accountRoleLabel(user)}
              </span>
            </span>
            <ChevronDown
              className={`account-chevron h-4 w-4 text-slate-500 ${accountOpen ? "is-open" : ""}`}
            />
          </button>

          {accountOpen ? (
            <div
              id="react-account-dropdown"
              role="menu"
              className="account-menu"
            >
              <div className="account-menu-profile">
                <GlassAvatar className="account-menu-avatar" glowEffect={false} aria-hidden="true">
                  <GlassAvatarFallback>
                    <UserRound className="h-5 w-5" />
                  </GlassAvatarFallback>
                </GlassAvatar>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-800">
                    {account.name}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {account.description}
                  </p>
                  <span className="account-role-badge">{accountRoleLabel(user)}</span>
                </div>
              </div>
              <div className="account-menu-divider" />
              {user.role === ROLES.SUPER_ADMIN ? (
                <button
                  type="button"
                  role="menuitem"
                  className="account-admin-button"
                  onClick={onOpenAdmin}
                >
                  <Activity className="h-4 w-4" />
                  <span>Akses Administrator</span>
                </button>
              ) : null}
              <button
                type="button"
                role="menuitem"
                className="account-logout-button"
                onClick={() => void onLogout()}
              >
                <LogOut className="h-4 w-4" />
                <span>Keluar Sistem</span>
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );

  return (
    <>
      <header className={`app-topbar app-topbar--liquid sticky top-0 z-30 ${mobileHeaderHidden ? "is-mobile-header-hidden" : ""}`}>
        <div className="app-header-glass-host relative">
          <FluidGlassSurface
            className="app-header-glass-surface rounded-[18px] border border-white/25"
            radius={18}
            mode="bar"
          />
          <div className="app-header-content relative z-10 flex min-h-[68px] items-center justify-between gap-4 px-5 py-2">
            {headerContent}
          </div>
        </div>
      </header>
    </>
  );
}
