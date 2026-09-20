// Copyright (C) 2026 Johandi Arifiansyach

export const DATA_WILAYAH = {
    "Desa Demo": ["Posyandu Demo 1", "Posyandu Demo 2"]
} as Record<string, string[]>;

export const ROLES = {
    KADER: "Kader Posyandu",
    BIDAN: "Bidan Desa",
    GIZI: "Ahli Gizi",
    SUPER_ADMIN: "super_admin"
};

export function isFullAccessRole(role: string): boolean {
    return role === ROLES.GIZI || role === ROLES.SUPER_ADMIN;
}

export const DASHBOARD_TABS = [
    'dashboard',
    'analisis_gizi',
    'data_balita',
    'asi_eksklusif',
    'mpasi',
    'problem_underweight',
    'problem_stunting',
    'problem_wasting',
    'problem_tidak_naik',
    'pmt_program',
    'recent',
    'change_history',
    'recycle_bin',
    'add_child',
    'measurement',
    'admin_backend'
];

export const COMPACT_SIDEBAR_MEDIA_QUERY = '(min-width: 768px), (orientation: landscape) and (min-width: 560px)';

export const MONTHS = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

export const YEARS = [2025, 2026, 2027, 2028, 2029, 2030];
