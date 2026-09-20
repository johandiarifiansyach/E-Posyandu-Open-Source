// SPDX-License-Identifier: GPL-3.0-or-later


import type { ReactNode } from 'react';

export type MaintenanceLayoutProps = { children: ReactNode };

export default function MaintenanceLayout({ children }: MaintenanceLayoutProps) {
  return <main className="maintenance-layout">{children}</main>;
}
