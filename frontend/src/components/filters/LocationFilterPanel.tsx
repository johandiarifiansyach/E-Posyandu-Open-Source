// SPDX-License-Identifier: GPL-3.0-or-later


import { motion, useReducedMotion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { useEffect, useState, type ChangeEvent, type ReactNode } from 'react';
import { DATA_WILAYAH, isFullAccessRole, MONTHS, ROLES, YEARS } from '../../config/dashboard';
import { AGE_GROUP_OPTIONS, DEFAULT_AGE_GROUP, type AgeGroup } from '../../config/ageFilters';
import { GlassSelect } from '../base';

type AgeGroupOption = { value: AgeGroup; label: string };
type FilterUser = { desa?: string | null };

export type LocationFilterPanelProps = {
  draftDesa: string;
  draftPosyandu: string;
  filterMonth: number;
  filterYear: number;
  ageGroup?: AgeGroup;
  ageGroupOptions?: readonly AgeGroupOption[];
  role: string;
  setAgeGroup?: (value: AgeGroup) => void;
  setDraftDesa: (value: string) => void;
  setDraftPosyandu: (value: string) => void;
  setFilterMonth: (value: number) => void;
  setFilterYear: (value: number) => void;
  user: FilterUser;
  showAgeGroupFilter?: boolean;
};

type FilterChipProps = {
  label: string;
  value: string | number;
  active?: boolean;
  disabled?: boolean;
  className?: string;
  selectAriaLabel: string;
  onChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  children: ReactNode;
};

const CHIP_SPRING = {
  type: 'spring' as const,
  stiffness: 420,
  damping: 26,
  mass: 0.58,
};

function notifyFilterContext(ageGroup: AgeGroup, month: number, year: number) {
  if (typeof window === 'undefined') return;
  const filterDate = new Date(year, month, 0).toISOString();
  window.__ePosyanduAgeGroup = ageGroup;
  window.__ePosyanduFilterDate = filterDate;
  window.dispatchEvent(
    new CustomEvent('e-posyandu-filter-context-change', {
      detail: { ageGroup, filterDate },
    }),
  );
}

function FilterChip({
  label,
  value,
  active = false,
  disabled = false,
  className = '',
  selectAriaLabel,
  onChange,
  children,
}: FilterChipProps) {
  const [focused, setFocused] = useState(false);
  const reducedMotion = useReducedMotion();

  return (
    <motion.label
      className={`filter-glass-chip relative min-w-0 rounded-2xl border border-white/20 bg-white/40 ${className}`.trim()}
      animate={{ scale: focused && !reducedMotion ? 1.02 : 1 }}
      transition={reducedMotion ? { duration: 0 } : CHIP_SPRING}
    >
      <span className="filter-glass-chip-label">{label}</span>
      {active ? (
        <span
          className="filter-glass-chip-active-dot"
          title={`${label} aktif`}
          aria-hidden="true"
        />
      ) : null}
      <GlassSelect
          value={value}
          disabled={disabled}
          aria-label={selectAriaLabel}
          onChange={onChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          wrapperClassName="filter-glass-chip-control"
          className="filter-glass-chip-select"
          showChevron={false}
        >
          {children}
        </GlassSelect>
      <ChevronDown
        className="filter-glass-chip-chevron"
        aria-hidden="true"
        strokeWidth={1.9}
      />
    </motion.label>
  );
}

export default function LocationFilterPanel({
  draftDesa,
  draftPosyandu,
  filterMonth,
  filterYear,
  ageGroup = DEFAULT_AGE_GROUP,
  ageGroupOptions = AGE_GROUP_OPTIONS,
  role,
  setAgeGroup,
  setDraftDesa,
  setDraftPosyandu,
  setFilterMonth,
  setFilterYear,
  user,
  showAgeGroupFilter = true,
}: LocationFilterPanelProps) {
  const options = ageGroupOptions.length ? ageGroupOptions : AGE_GROUP_OPTIONS;
  const selectedAgeGroup = options.some((option) => option.value === ageGroup)
    ? ageGroup
    : options[0].value;
  const fullAccess = isFullAccessRole(role);
  const hasLocationFilter = role !== ROLES.KADER;
  const activeDesa = fullAccess ? draftDesa : user.desa || '';
  const posyanduOptions = activeDesa
    ? DATA_WILAYAH[activeDesa as keyof typeof DATA_WILAYAH] || []
    : [];

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.__ePosyanduAgeGroup = selectedAgeGroup;
    window.__ePosyanduFilterDate = new Date(filterYear, filterMonth, 0).toISOString();
  }, [filterMonth, filterYear, selectedAgeGroup]);

  const monthChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const month = Number(event.target.value);
    setFilterMonth(month);
    notifyFilterContext(selectedAgeGroup, month, filterYear);
  };

  const yearChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const year = Number(event.target.value);
    setFilterYear(year);
    notifyFilterContext(selectedAgeGroup, filterMonth, year);
  };

  const ageChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const next = event.target.value as AgeGroup;
    setAgeGroup?.(next);
    notifyFilterContext(next, filterMonth, filterYear);
    window.dispatchEvent(
      new CustomEvent('e-posyandu-age-group-change', { detail: next }),
    );
  };

  const activeDesaFilter = fullAccess && Boolean(draftDesa);
  const activePosyanduFilter = Boolean(draftPosyandu);
  const filterCount =
    2 +
    (showAgeGroupFilter ? 1 : 0) +
    (hasLocationFilter ? (fullAccess ? 2 : 1) : 0);

  return (
    <section
      className={`filter-glass-panel rounded-[28px] bg-white/30 ring-1 ring-white/30 backdrop-blur-2xl backdrop-saturate-150 ${hasLocationFilter ? '' : 'filter-glass-panel--period-only'}`.trim()}
      aria-label={hasLocationFilter ? 'Periode dan wilayah data' : 'Periode data'}
      data-scope-panel="true"
    >
      <div className="filter-glass-panel-highlight" aria-hidden="true" />
      <div className="relative z-10">
        <div className={`filter-glass-grid filter-glass-grid--${filterCount}`}>
          <FilterChip
            label="Bulan"
            value={filterMonth}
            className="filter-glass-chip-month"
            selectAriaLabel="Pilih bulan"
            onChange={monthChange}
          >
            {MONTHS.map((month, index) => (
              <option key={month} value={index + 1}>
                {month}
              </option>
            ))}
          </FilterChip>

          <FilterChip
            label="Tahun"
            value={filterYear}
            className="filter-glass-chip-year"
            selectAriaLabel="Pilih tahun"
            onChange={yearChange}
          >
            {YEARS.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </FilterChip>

          {showAgeGroupFilter ? (
            <FilterChip
              label="Umur"
              value={selectedAgeGroup}
              className="filter-glass-chip-age"
              selectAriaLabel="Pilih kelompok umur"
              onChange={ageChange}
            >
              {options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </FilterChip>
          ) : null}

          {hasLocationFilter && fullAccess ? (
            <FilterChip
              label="Desa / Kelurahan"
              value={draftDesa}
              active={activeDesaFilter}
              className="filter-glass-chip-location-start filter-glass-chip-desa"
              selectAriaLabel="Pilih desa atau kelurahan"
              onChange={(event) => {
                setDraftDesa(event.target.value);
                setDraftPosyandu('');
              }}
            >
              <option value="">Semua Desa</option>
              {Object.keys(DATA_WILAYAH).map((desa) => (
                <option key={desa} value={desa}>
                  {desa}
                </option>
              ))}
            </FilterChip>
          ) : null}

          {hasLocationFilter ? (
            <FilterChip
              label="Posyandu"
              value={draftPosyandu}
              active={activePosyanduFilter}
              disabled={!activeDesa}
              className={!fullAccess ? 'filter-glass-chip-location-start filter-glass-chip-location-only' : 'filter-glass-chip-posyandu'}
              selectAriaLabel="Pilih posyandu"
              onChange={(event) => setDraftPosyandu(event.target.value)}
            >
              <option value="">Semua Posyandu</option>
              {posyanduOptions.map((posyandu) => (
                <option key={posyandu} value={posyandu}>
                  {posyandu}
                </option>
              ))}
            </FilterChip>
          ) : null}
        </div>
      </div>
    </section>
  );
}
