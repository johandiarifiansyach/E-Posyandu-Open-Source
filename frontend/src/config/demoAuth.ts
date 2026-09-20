// SPDX-License-Identifier: GPL-3.0-or-later


/**
 * Credentials used only by the Vite development server.
 *
 * The production bundle never enables this path. Keeping the accounts here
 * makes a fresh checkout immediately usable for UI demonstrations without
 * requiring a hosted authentication provider first.
 */
export const DEMO_PASSWORD = import.meta.env.VITE_DEMO_PASSWORD || 'Demo123!';

export type DemoAccount = {
  key: string;
  email: string;
  aliases: string[];
  role: 'super_admin' | 'Ahli Gizi' | 'Bidan Desa' | 'Kader Posyandu';
  desa: string | null;
  posyandu: string | null;
};

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    key: 'admin',
    email: 'admin@demo.eposyandu.local',
    aliases: ['admin', 'admin-demo', 'admin@demo.eposyandu.local'],
    role: 'super_admin',
    desa: null,
    posyandu: null,
  },
  {
    key: 'gizi',
    email: 'gizi@demo.eposyandu.local',
    aliases: ['gizi', 'gizi-demo', 'gizi@demo.eposyandu.local'],
    role: 'Ahli Gizi',
    desa: null,
    posyandu: null,
  },
  {
    key: 'bidan',
    email: 'bidan@demo.eposyandu.local',
    aliases: ['bidan', 'bidan-demo', 'bidan@demo.eposyandu.local'],
    role: 'Bidan Desa',
    desa: 'Desa Demo',
    posyandu: null,
  },
  {
    key: 'kader',
    email: 'kader@demo.eposyandu.local',
    aliases: ['kader', 'kader-demo', 'kader@demo.eposyandu.local'],
    role: 'Kader Posyandu',
    desa: 'Desa Demo',
    posyandu: 'Posyandu Demo 1',
  },
];

export function isDemoAuthEnabled(): boolean {
  // `DEV` is replaced by Vite at build time, so this fallback cannot be
  // enabled accidentally in a production build.
  return import.meta.env.DEV && import.meta.env.VITE_DEMO_AUTH !== 'false';
}

export function findDemoAccount(username: string): DemoAccount | null {
  const normalized = username.trim().toLowerCase();
  return DEMO_ACCOUNTS.find((account) => account.aliases.includes(normalized)) || null;
}

export function demoProfile(account: DemoAccount, userId = `demo-${account.key}`) {
  return {
    userId,
    email: account.email,
    role: account.role,
    desa: account.desa,
    posyandu: account.posyandu,
    accessMode: 'write' as const,
  };
}
