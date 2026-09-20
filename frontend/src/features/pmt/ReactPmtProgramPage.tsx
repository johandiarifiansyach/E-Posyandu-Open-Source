// SPDX-License-Identifier: GPL-3.0-or-later


import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Calendar,
  ChevronDown,
  FileDown,
  Filter,
  Gift,
  Loader2,
  Minus,
  Search,
  Trash2,
  TrendingDown,
  X,
} from "../../ui/icons";
import { appId, db } from "../../app/session";
import { collection, onSnapshot, orderBy, query } from "../../api/syncApi";
import {
  AppButton,
  Card,
  DataTable,
  HorizontalTableScrollbar,
  KenaikanBadge,
  StatusBadge,
  SkeletonBlock,
  VirtualizedTableBody,
} from "../../components/base";
import MobileProgramCard from "../../components/data-display/MobileProgramCard";
import { formatIndoDate } from "../../shared/formatters";
import type { DashboardUser } from "../../types";
import { DEFAULT_AGE_GROUP, matchesAgeGroup } from "../../config/ageFilters";
import { getChildDetail } from "../../api/childrenApi";
import PmtMonitoringModal from "./PmtMonitoringModal";
import {
  CATEGORY_OPTIONS,
  baselineForProgram,
  categoryLabel,
  categoryMetric,
  getMonitoringForWeek,
  maxWeeksForCategory,
  monitoringStatus,
  numericValue,
} from "./pmtRules";
import { NIK_STATUS_OPTIONS, childMatchesNikStatus, type NikStatus } from "../../config/nikFilters";
import { useIsMobileViewport } from "../../hooks/useMediaQuery";

type Program = Record<string, any>;
type Child = Record<string, any>;

export type ReactPmtProgramPageProps = {
  user?: DashboardUser;
  childrenData?: Child[];
  pmtPrograms?: Program[];
  ageGroup?: string;
  currentFilterDate?: Date;
  onExportPmt?: () => void;
  onDeleteProgram?: (program: Program) => void;
  onOpenMonitoring?: (program: Program, child: Child) => Promise<void> | void;
  pageState?: {
    status: "idle" | "loading" | "success" | "error";
    data?: Program[];
    message?: string;
  };
};

function categoryIcon(category: string) {
  if (category === "Wasting") return AlertCircle;
  if (category === "Underweight") return TrendingDown;
  return Minus;
}

function statusResult(category: string, status: string) {
  if (!status || status === "-")
    return <span className="text-slate-400">-</span>;
  return category === "TidakNaik" ? (
    <KenaikanBadge status={status} />
  ) : (
    <StatusBadge status={status} />
  );
}

const MeasurementCell = memo(function MeasurementCell({
  category,
  status,
  date,
  weight,
  height,
}: {
  category: string;
  status: string;
  date?: unknown;
  weight?: unknown;
  height?: unknown;
}) {
  const parsedWeight = numericValue(weight);
  const parsedHeight = numericValue(height);
  if (parsedWeight === null && parsedHeight === null)
    return <span className="text-slate-400">-</span>;
  return (
    <div className="pmt-measurement-cell">
      {date ? (
        <span className="pmt-measurement-date">
          {formatIndoDate(String(date))}
        </span>
      ) : null}
      <span className="pmt-measurement-value">BB {parsedWeight ?? "-"} kg</span>
      <span className="pmt-measurement-value">TB {parsedHeight ?? "-"} cm</span>
      <div className="mt-1">{statusResult(category, status)}</div>
    </div>
  );
});

const PmtTableHeader = memo(function PmtTableHeader({ weeks }: { weeks: number[] }) {
  return (
    <thead>
      <tr>
        <th className="pmt-col-number">No.</th>
        <th className="pmt-col-child">Balita</th>
        <th>Kategori / Indikator</th>
        <th>Sumber Anggaran</th>
        <th>Mitra</th>
        <th>Tanggal Awal</th>
        <th className="pmt-week-column">Pengukuran Awal</th>
        {weeks.map((week) => (
          <th key={week} className="pmt-week-column">
            Minggu {week}
          </th>
        ))}
        <th className="pmt-col-action">Aksi</th>
      </tr>
    </thead>
  );
});

type PmtTableRowProps = {
  program: Program;
  child?: Child;
  index: number;
  weeks: number[];
  openingProgramId: string | null;
  onOpenMonitoring: (program: Program, child: Child | undefined) => void;
  onDeleteProgram?: (program: Program) => void;
};

/** Isolated PMT row.  PMT monitoring state changes should only update the
 * selected row/action, not rebuild every programme row in the table. */
const PmtTableRow = memo(function PmtTableRow({
  program,
  child,
  index,
  weeks,
  openingProgramId,
  onOpenMonitoring,
  onDeleteProgram,
}: PmtTableRowProps) {
  const programKey = String(program.id || program.childId || index);
  const baseline = baselineForProgram(program, child);
  const programWeeks = maxWeeksForCategory(program.category);
  const category = String(program.category || "TidakNaik");
  const Icon = categoryIcon(category);
  const partner = program.mitraLain || program.mitra || "-";
  return (
    <tr className="ios-data-row">
      <td className="pmt-col-number">{index + 1}</td>
      <td className="pmt-col-child">
        <strong>{program.childName || child?.nama || "-"}</strong>
        <span>
          {child
            ? `${child.desa || ""} / ${child.posyandu || ""}`
            : "Data wilayah tersedia saat balita dimuat"}
        </span>
      </td>
      <td>
        <div className={`pmt-category-label pmt-category-${category.toLowerCase()}`}>
          <Icon className="h-4 w-4" />
          <span>{categoryLabel(category)}</span>
        </div>
        <span className="pmt-metric-label">Status {categoryMetric(category)}</span>
      </td>
      <td>{program.sumberAnggaran || "-"}</td>
      <td>{partner}</td>
      <td className="whitespace-nowrap">{formatIndoDate(String(baseline.date || ""))}</td>
      <td className="pmt-week-column">
        <MeasurementCell
          category={category}
          status={monitoringStatus(program, child, null, 0, baseline)}
          date={baseline.date}
          weight={baseline.weight}
          height={baseline.height}
        />
      </td>
      {weeks.map((week) => {
        const monitoring = getMonitoringForWeek(program, week);
        return week > programWeeks ? (
          <td key={week} className="pmt-week-column pmt-week-disabled">Tidak berlaku</td>
        ) : (
          <td key={week} className="pmt-week-column">
            <MeasurementCell
              category={category}
              status={monitoringStatus(program, child, monitoring, week, baseline)}
              date={monitoring?.tgl}
              weight={monitoring?.bb}
              height={monitoring?.tb}
            />
          </td>
        );
      })}
      <td className="pmt-col-action">
        <div className="pmt-row-actions">
          <button
            type="button"
            className="table-action-button table-action-blue"
            disabled={!child || Boolean(openingProgramId)}
            aria-label={`Pantau PMT ${program.childName || "balita"}`}
            onClick={() => onOpenMonitoring(program, child)}
          >
            {openingProgramId === programKey ? (
              <Loader2 className="h-4 w-4" />
            ) : (
              <Calendar className="h-4 w-4" />
            )}
          </button>
          {onDeleteProgram ? (
            <button
              type="button"
              className="table-action-button table-action-red"
              disabled={!program.id}
              aria-label={`Hapus PMT ${program.childName || "balita"}`}
              onClick={() => onDeleteProgram(program)}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </td>
    </tr>
  );
});

export default function ReactPmtProgramPage({
  user,
  childrenData = [],
  pmtPrograms = [],
  ageGroup = DEFAULT_AGE_GROUP,
  currentFilterDate = new Date(),
  onExportPmt,
  onDeleteProgram,
  onOpenMonitoring,
  pageState,
}: ReactPmtProgramPageProps) {
  const [categoryFilter, setCategoryFilter] = useState("Semua");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("recent");
  const [nikStatus, setNikStatus] = useState<NikStatus>("all");
  const [openingProgramId, setOpeningProgramId] = useState<string | null>(null);
  const tableViewportRef = useRef<HTMLDivElement>(null);
  const [selectedMonitoring, setSelectedMonitoring] = useState<{
    program: Program;
    child: Child;
  } | null>(null);
  const [remotePrograms, setRemotePrograms] = useState<Program[]>([]);
  const [remoteChildren, setRemoteChildren] = useState<Child[]>([]);
  const [remoteState, setRemoteState] = useState<
    "loading" | "success" | "error"
  >("loading");
  const isMobileViewport = useIsMobileViewport();

  useEffect(() => {
    const programsQuery = query(
      collection(db, "artifacts", appId, "public", "data", "pmt_programs"),
      orderBy("createdAt", "desc"),
    );
    return onSnapshot(
      programsQuery,
      (snapshot) => {
        setRemotePrograms(
          snapshot.docs.map((document) => ({
            id: document.id,
            ...document.data(),
          })),
        );
        setRemoteState("success");
      },
      () => setRemoteState("error"),
    );
  }, [user?.role]);

  // The PMT endpoint returns programme rows separately from the child
  // registry.  Resolve only the linked children needed by those rows instead
  // of loading the complete 3k-child collection, while still retaining the
  // legacy behaviour where every programme is classified by the child's age
  // and location before it is displayed.
  useEffect(() => {
    let active = true;
    const known = new Set(
      childrenData.filter((child) => child.id).map((child) => String(child.id)),
    );
    const missingIds = Array.from(
      new Set(
        remotePrograms
          .map((program) => String(program.childId || program.child_id || ""))
          .filter((id) => id && !known.has(id)),
      ),
    ).slice(0, 200);
    if (!missingIds.length) {
      setRemoteChildren([]);
      return () => {
        active = false;
      };
    }
    void Promise.allSettled(missingIds.map((id) => getChildDetail(id))).then(
      (results) => {
        if (!active) return;
        setRemoteChildren(
          results.flatMap((result) =>
            result.status === "fulfilled"
              ? [{ id: result.value.id, ...result.value.data }]
              : [],
          ),
        );
      },
    );
    return () => {
      active = false;
    };
  }, [childrenData, remotePrograms]);

  const displayedPrograms = useMemo(
    () =>
      pageState?.status === "success"
        ? pageState.data || []
        : pmtPrograms.length
          ? pmtPrograms
          : remotePrograms,
    [pageState?.data, pageState?.status, pmtPrograms, remotePrograms],
  );
  const childById = useMemo(
    () =>
      new Map(
        [...childrenData, ...remoteChildren]
          .filter((child) => child.id)
          .map((child) => [String(child.id), child]),
      ),
    [childrenData, remoteChildren],
  );
  const filteredPrograms = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const ageFiltered = displayedPrograms.filter((program) => {
      const child =
        childById.get(String(program.childId)) ||
        (program.child && typeof program.child === "object"
          ? (program.child as Child)
          : undefined);
      const age = Number(
        program.ageInMonths ?? program.usiaBulan ?? child?.ageInMonths,
      );
      const cohortMatch =
        ageGroup === "6-23" && Number.isFinite(age) && age >= 6 && age <= 23;
      const haystack = [
        program.childName,
        child?.nama,
        child?.name,
        child?.nik,
        child?.national_id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return (
        Boolean(child && matchesAgeGroup(child, ageGroup, currentFilterDate)) ||
        cohortMatch
      ) && (!needle || haystack.includes(needle)) && childMatchesNikStatus(child || {}, nikStatus);
    });
    const categoryFiltered =
      categoryFilter === "Semua"
        ? ageFiltered
        : ageFiltered.filter((program) => program.category === categoryFilter);
    return [...categoryFiltered].sort((left, right) => {
      const leftChild = childById.get(String(left.childId));
      const rightChild = childById.get(String(right.childId));
      if (sort === "name_asc" || sort === "name_desc") {
        const result = String(left.childName || leftChild?.nama || "").localeCompare(
          String(right.childName || rightChild?.nama || ""),
          "id",
        );
        return sort === "name_desc" ? -result : result;
      }
      if (sort === "oldest_input") {
        return String(left.createdAt || "").localeCompare(String(right.createdAt || ""));
      }
      return String(right.createdAt || "").localeCompare(String(left.createdAt || ""));
    });
  }, [
    ageGroup,
    categoryFilter,
    childById,
    currentFilterDate,
    displayedPrograms,
    nikStatus,
    search,
    sort,
  ]);
  const visibleWeekCount = useMemo(
    () =>
      categoryFilter === "Semua"
        ? Math.max(
            2,
            ...filteredPrograms.map((program) =>
              maxWeeksForCategory(program.category),
            ),
          )
        : maxWeeksForCategory(categoryFilter),
    [categoryFilter, filteredPrograms],
  );
  const weeks = useMemo(
    () => Array.from({ length: visibleWeekCount }, (_, index) => index + 1),
    [visibleWeekCount],
  );
  const pageLoading = pageState?.status === "loading";
  const pageError = pageState?.status === "error" ? pageState.message : null;
  const waiting =
    pageLoading ||
    (!pageState && remoteState === "loading" && !pmtPrograms.length);

  const openMonitoring = useCallback(
    async (program: Program, child: Child | undefined) => {
      const programKey = String(program.id || program.childId || "");
      if (!child || !program.childId || !programKey || openingProgramId) return;
      setOpeningProgramId(programKey);
      try {
        if (onOpenMonitoring) await onOpenMonitoring(program, child);
        else setSelectedMonitoring({ program, child });
      } finally {
        setOpeningProgramId(null);
      }
    },
    [onOpenMonitoring, openingProgramId],
  );
  const renderPmtRow = useCallback(
    (program: Program, index: number) => {
      const child =
        childById.get(String(program.childId)) ||
        (program.child && typeof program.child === "object"
          ? (program.child as Child)
          : undefined);
      return (
        <PmtTableRow
          key={String(program.id || program.childId || index)}
          program={program}
          child={child}
          index={index}
          weeks={weeks}
          openingProgramId={openingProgramId}
          onOpenMonitoring={openMonitoring}
          onDeleteProgram={onDeleteProgram}
        />
      );
    },
    [childById, onDeleteProgram, openMonitoring, openingProgramId, weeks],
  );

  return (
    <div
      className="pmt-page apple-page space-y-6"
      data-pmt-page="true"
      data-react-pmt-page="true"
    >
      {selectedMonitoring ? (
        <PmtMonitoringModal
          program={selectedMonitoring.program}
          child={selectedMonitoring.child}
          onClose={() => setSelectedMonitoring(null)}
          onSaved={() => setRemotePrograms((current) => [...current])}
        />
      ) : null}
      <section className="children-table-panel relative overflow-hidden rounded-[28px] border border-white/25 bg-white/40 p-4 shadow-[0_18px_48px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.65)] ring-1 ring-white/25 backdrop-blur-2xl backdrop-saturate-150 sm:p-5">
        <div className="children-table-panel-highlight" aria-hidden="true" />
        <div className="relative z-10 space-y-4">
          <div className="children-table-summary flex flex-col gap-3 rounded-[22px] bg-white/20 px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:px-4">
            <h2 className="apple-page-title flex items-center gap-2">
              <span className="apple-symbol-tile apple-symbol-tile-green" aria-hidden="true">
                <Gift className="h-5 w-5" />
              </span>
              Program Pemberian PMT
            </h2>
            <p className="text-sm text-slate-500">
              Menampilkan <span className="children-table-count-pill">{filteredPrograms.length}</span>{" "}
              balita penerima PMT
            </p>
          </div>
          <div className="children-table-toolbar flex flex-col gap-3 rounded-[22px] border border-white/20 bg-white/20 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] lg:flex-row lg:items-center">
            <div className="flex w-full sm:w-72">
              <label className="sr-only" htmlFor="react-pmt-search">
                Cari Nama / NIK
              </label>
              <div className="relative min-w-0 flex-1">
                <span className="children-table-control-icon children-table-search-icon-wrap pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 rounded-full bg-blue-100 text-[#0057b7]">
                  <Search
                    className="children-table-search-icon h-[22px] w-[22px]"
                    style={{ color: "#0057b7" }}
                    strokeWidth={2.6}
                  />
                </span>
                <input
                  id="react-pmt-search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Cari Nama / NIK..."
                  className="children-table-search-input min-h-11 w-full rounded-full border border-white/20 bg-white/50 py-2.5 pl-11 pr-8 text-sm text-slate-700 outline-none shadow-sm placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
                {search ? (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 transition hover:bg-white/60 hover:text-slate-700"
                    aria-label="Hapus pencarian"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            </div>
            <div className="children-table-select-wrap relative w-full sm:w-52">
              <label className="sr-only" htmlFor="react-pmt-sort">Urutkan data</label>
              <select
                id="react-pmt-sort"
                value={sort}
                onChange={(event) => setSort(event.target.value)}
                className="children-table-select min-h-11 w-full appearance-none rounded-full border border-white/20 bg-white/50 py-2.5 pl-11 pr-9 text-sm text-slate-700 outline-none shadow-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              >
                <option value="recent">Terbaru Ditambahkan</option>
                <option value="oldest_input">Awal Diinput</option>
                <option value="name_asc">Nama (A-Z)</option>
                <option value="name_desc">Nama (Z-A)</option>
              </select>
              <span className="children-table-control-icon pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 rounded-full bg-blue-500/10 text-[#007aff]"><Filter className="h-4 w-4" /></span>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>
            <div className="children-table-select-wrap relative w-full sm:w-52">
              <label className="sr-only" htmlFor="react-pmt-nik-status">Filter NIK</label>
              <select
                id="react-pmt-nik-status"
                value={nikStatus}
                onChange={(event) => setNikStatus(event.target.value as NikStatus)}
                className="children-table-select min-h-11 w-full appearance-none rounded-full border border-white/20 bg-white/50 py-2.5 pl-11 pr-9 text-sm text-slate-700 outline-none shadow-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              >
                {NIK_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <span className="children-table-control-icon pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 rounded-full bg-blue-500/10 text-[#007aff]"><Filter className="h-4 w-4" /></span>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>
            <div className="children-table-select-wrap relative w-full sm:w-52">
              <label className="sr-only" htmlFor="react-pmt-category">Filter kategori PMT</label>
              <select
                id="react-pmt-category"
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                className="children-table-select min-h-11 w-full appearance-none rounded-full border border-white/20 bg-white/50 py-2.5 pl-11 pr-9 text-sm text-slate-700 outline-none shadow-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              >
                {CATEGORY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <span className="children-table-control-icon pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 rounded-full bg-blue-500/10 text-[#007aff]"><Filter className="h-4 w-4" /></span>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>
            <div className="children-table-actions no-scrollbar flex min-w-0 gap-2 overflow-x-auto pb-1 sm:pb-0 lg:ml-auto">
              {onExportPmt ? (
                <AppButton
                  type="button"
                  variant="ghost"
                  onClick={onExportPmt}
                  className="children-table-action children-table-export-action children-table-export-action--table ios-toolbar-button icon-only-mobile whitespace-nowrap"
                  title="Export program PMT ke XLS"
                >
                  <span className="ios-button-symbol" aria-hidden="true"><FileDown className="h-4 w-4" /></span>
                  <span className="hidden sm:inline">Export PMT (XLS)</span>
                </AppButton>
              ) : null}
            </div>
          </div>
          {pageError || remoteState === "error" ? (
            <div
              className="pmt-empty-state ios-inline-notification ios-inline-notification-error"
              role="alert"
            >
              <AlertCircle className="h-8 w-8" />
              <p>
                Gagal memuat program PMT: {pageError || "Periksa koneksi lalu coba lagi."}
              </p>
            </div>
          ) : null}
          {isMobileViewport ? (
          <div className="mobile-children-list space-y-3 md:hidden" aria-label="Daftar penerima PMT">
            {waiting ? (
              Array.from({ length: 4 }, (_, index) => (
                <div key={index} className="mobile-child-card rounded-2xl bg-white/40 p-4 space-y-2.5 backdrop-blur-xl ring-1 ring-white/25" aria-hidden="true">
                  <SkeletonBlock className="h-4 w-44" />
                  <SkeletonBlock className="h-3 w-32" />
                  <SkeletonBlock className="h-10 w-full rounded-xl" />
                </div>
              ))
            ) : filteredPrograms.length === 0 ? (
              <div className="mobile-child-card rounded-2xl bg-white/40 p-6 text-center text-sm text-slate-400 ring-1 ring-white/25">
                Belum ada program PMT pada kategori ini.
              </div>
            ) : (
              filteredPrograms.map((program, index) => {
                const child =
                  childById.get(String(program.childId)) ||
                  (program.child && typeof program.child === "object" ? (program.child as Child) : undefined);
                const mobileChild: Child = child || {
                  id: program.childId,
                  nama: program.childName || "Balita",
                  desa: program.desa,
                  posyandu: program.posyandu,
                };
                const baseline = baselineForProgram(program, child);
                const category = String(program.category || "TidakNaik");
                const Icon = categoryIcon(category);
                const programKey = String(program.id || program.childId || index);
                const status = monitoringStatus(program, child, null, 0, baseline);
                return (
                  <MobileProgramCard
                    key={programKey}
                    child={mobileChild}
                    asOf={currentFilterDate.toISOString().slice(0, 10)}
                    action={
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          className="mobile-program-action mobile-program-action--blue"
                          disabled={!child || Boolean(openingProgramId)}
                          aria-label={`Pantau PMT ${program.childName || "balita"}`}
                          onClick={() => void openMonitoring(program, child)}
                        >
                          {openingProgramId === programKey ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calendar className="h-4 w-4" />}
                        </button>
                        {onDeleteProgram ? (
                          <button
                            type="button"
                            className="mobile-program-action mobile-program-action--red"
                            disabled={!program.id}
                            aria-label={`Hapus PMT ${program.childName || "balita"}`}
                            onClick={() => onDeleteProgram(program)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        ) : null}
                      </div>
                    }
                  >
                    <div className="grid grid-cols-2 gap-2">
                      <div className="mobile-child-status mobile-child-status--neutral justify-start gap-2 px-3 text-left">
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="mobile-child-status-value">{categoryLabel(category)}</span>
                      </div>
                      <div className="mobile-child-measurement-cell">
                        <span>Tanggal mulai</span>
                        <strong>{baseline.date ? formatIndoDate(String(baseline.date)) : "—"}</strong>
                      </div>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-slate-500">
                      <span className="truncate">Status: {status || "—"}</span>
                      <span className="truncate text-right">Mitra: {String(program.mitraLain || program.mitra || "—")}</span>
                    </div>
                  </MobileProgramCard>
                );
              })
            )}
          </div>
          ) : null}
          {!isMobileViewport ? (
          <div className="hidden md:block">
          <Card className="pmt-table-card children-table-card program-table-card ios-table-card">
        {waiting ? (
          <DataTable
            ref={tableViewportRef}
            className="pmt-table-scroll program-table-scroll"
            ariaLabel="Memuat tabel pemantauan PMT"
          >
            <table className="pmt-data-table ios-data-table" aria-busy="true">
              <PmtTableHeader weeks={weeks} />
              <tbody>
                {Array.from({ length: 5 }, (_, row) => (
                  <tr key={row}>
                    {Array.from({ length: 8 + weeks.length }, (_, column) => (
                      <td key={column} className="px-3 py-4">
                        <SkeletonBlock
                          className={column === 1 ? "h-4 w-36" : "h-4 w-16"}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTable>
        ) : filteredPrograms.length === 0 ? (
          <div className="pmt-empty-state">
            <Gift className="h-8 w-8" />
            <p>Belum ada program PMT pada kategori ini.</p>
          </div>
        ) : (
          <DataTable
            ref={tableViewportRef}
            className="pmt-table-scroll program-table-scroll"
            ariaLabel="Tabel pemantauan PMT"
          >
            <table className="pmt-data-table ios-data-table">
              <PmtTableHeader weeks={weeks} />
              <VirtualizedTableBody
                items={filteredPrograms}
                colSpan={8 + weeks.length}
                rowKey={(program, index) => String(program.id || program.childId || index)}
                renderRow={renderPmtRow}
                estimateRowHeight={112}
                className="divide-y divide-slate-100"
              />
            </table>
          </DataTable>
        )}
        {waiting || (!pageError && remoteState !== "error" && filteredPrograms.length > 0) ? (
          <HorizontalTableScrollbar
            viewportRef={tableViewportRef}
            refreshKey={`${filteredPrograms.length}-${visibleWeekCount}-${categoryFilter}`}
          />
        ) : null}
          </Card>
          </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
