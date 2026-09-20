// SPDX-License-Identifier: GPL-3.0-or-later


/** Authenticated profile used by every React-owned feature. */
export type DashboardUser = {
  role: string;
  desa: string | null;
  posyandu: string | null;
  accessMode: 'read' | 'write';
};
