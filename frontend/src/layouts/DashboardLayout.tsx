// SPDX-License-Identifier: GPL-3.0-or-later


import type { ReactNode } from "react";

export type DashboardLayoutProps = {
  children: ReactNode;
  sidebar: ReactNode;
  topbar: ReactNode;
  /** Optional heading rendered inside the page content, below the top bar. */
  pageTitle?: ReactNode;
  footer?: ReactNode;
  mobileDock?: ReactNode;
  className?: string;
};

/**
 * Authenticated application frame.  The sidebar/topbar are slots so each
 * feature can migrate independently without changing the shell contract.
 */
export default function DashboardLayout({
  children,
  sidebar,
  topbar,
  pageTitle,
  footer,
  mobileDock,
  className = "",
}: DashboardLayoutProps) {
  return (
    <div
      className={`app-shell flex font-sans text-slate-900 ${className}`.trim()}
    >
      {sidebar}
      <div className="app-workspace flex min-w-0 flex-1 flex-col">
        {topbar}
        <main className="app-content flex-1 overflow-x-hidden p-4 pb-28 sm:p-6 sm:pb-28 md:pb-8 lg:p-8 lg:pb-8">
          {pageTitle ? (
            <div className="app-content-page-title" aria-label="Halaman aktif">
              <h1>{pageTitle}</h1>
            </div>
          ) : null}
          {children}
        </main>
        {footer}
      </div>
      {mobileDock}
    </div>
  );
}
