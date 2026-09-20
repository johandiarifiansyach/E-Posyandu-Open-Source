// Copyright (C) 2026 Johandi Arifiansyach

/** Authenticated profile used by every React-owned feature. */
export type DashboardUser = {
  role: string;
  desa: string | null;
  posyandu: string | null;
  accessMode: 'read' | 'write';
};
