// SPDX-License-Identifier: GPL-3.0-or-later


/** Filter choices for the child registry NIK source. */
export const NIK_STATUS_OPTIONS = [
  { value: 'all', label: 'Semua NIK' },
  { value: 'missing', label: 'Tidak Punya NIK' },
  { value: 'present', label: 'Punya NIK' },
] as const;

export type NikStatus = 'all' | typeof NIK_STATUS_OPTIONS[number]['value'];

export function isNikStatus(value: unknown): value is NikStatus {
  return value === 'all' || NIK_STATUS_OPTIONS.some((option) => option.value === value);
}

function isEnabledFlag(value: unknown): boolean {
  if (value === true || value === 1) return true;
  if (typeof value !== 'string') return false;
  return ['1', 'true', 'ya', 'yes'].includes(value.trim().toLowerCase());
}

export function childHasManualNik(child: Record<string, unknown>): boolean {
  // Accept both the canonical API boolean and values from older cached/raw
  // documents that may have been serialized as strings or numeric flags.
  return isEnabledFlag(child.hasNIK) || isEnabledFlag(child.has_national_id);
}

/**
 * Manual NIKs are explicitly entered in the identity form (`hasNIK=true`).
 * Automatically generated temporary NIKs remain visible but are marked red
 * in the table and belong to the "Tidak Punya NIK" group.
 */
export function childMatchesNikStatus(child: Record<string, unknown>, status: NikStatus): boolean {
  if (status === 'all') return true;
  const hasNik = childHasManualNik(child);
  return status === 'present' ? hasNik : !hasNik;
}
