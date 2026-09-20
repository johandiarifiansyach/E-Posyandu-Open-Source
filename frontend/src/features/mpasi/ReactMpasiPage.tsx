// Copyright (C) 2026 Johandi Arifiansyach

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getChildrenPage,
  type ChildrenPageRequest,
  type ChildrenPageResponse,
} from "../../api/childrenApi";
import { type AgeGroup } from "../../config/ageFilters";
import { isFullAccessRole, MONTHS, ROLES } from "../../config/dashboard";
import { formatIndoDate, getCompletedAgeInMonths } from "../../shared/formatters";
import { errorMessage, type PageState } from "../../shared/pageState";
import type { DashboardUser } from "../../types";
import {
  AppButton,
  Badge,
  Card,
  DataTable,
  HorizontalTableScrollbar,
  Pagination,
  SkeletonBlock,
} from "../../components/base";
import MobileProgramCard from "../../components/data-display/MobileProgramCard";
import MpasiModal from "../breastfeeding/MpasiModal";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { useIsMobileViewport } from "../../hooks/useMediaQuery";
import {
  ChevronDown,
  FileDown,
  Filter,
  MoreHorizontal,
  Pencil,
  Plus,
  Ruler,
  Search,
  Trash2,
  Utensils,
  X,
} from "../../ui/icons";
import { NIK_STATUS_OPTIONS, type NikStatus } from "../../config/nikFilters";

type Scope = {
  month: number;
  year: number;
  ageGroup: AgeGroup;
  desa?: string | null;
  posyandu?: string | null;
};
const PAGE_SIZE = 10;

function dateStart(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}-01`;
}
function dateEnd(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(new Date(year, month, 0).getDate()).padStart(2, "0")}`;
}
function display(value: unknown) {
  return value === null || value === undefined || value === ""
    ? "-"
    : String(value);
}
function dataOf(item: { data?: Record<string, unknown> }) {
  return item.data || {};
}
function hasValue(value: unknown) {
  return Array.isArray(value)
    ? value.length > 0
    : value !== null &&
        value !== undefined &&
        value !== "" &&
        value !== "Tidak";
}
function mpasiMap(response: ChildrenPageResponse) {
  const result = new Map<string, Record<string, unknown>>();
  for (const item of response.mpasiLogs || []) {
    const data = dataOf(item);
    const childId = String(data.childId || data.child_id || "");
    if (!childId) continue;
    const previous = result.get(childId);
    const currentDate = String(data.tglMonitoring || data.date || "");
    const previousDate = String(previous?.tglMonitoring || previous?.date || "");
    if (!previous || currentDate >= previousDate) result.set(childId, data);
  }
  return result;
}
function requestOf(
  scope: Scope,
  user: DashboardUser,
  page: number,
  search: string,
  nikStatus: NikStatus,
): ChildrenPageRequest {
  const village = isFullAccessRole(user.role)
    ? scope.desa || undefined
    : user.desa || undefined;
  const posyandu =
    user.role === "Kader Posyandu"
      ? user.posyandu || undefined
      : scope.posyandu || undefined;
  return {
    asOf: dateEnd(scope.year, scope.month),
    ageGroup: "6-23",
    measurementStart: dateStart(scope.year, scope.month),
    measurementEnd: dateEnd(scope.year, scope.month),
    page,
    nikStatus,
    size: PAGE_SIZE,
    sort: "recent",
    view: "mpasi",
    search: search || undefined,
    village,
    posyandu,
  };
}

function TableSkeleton({ columns }: { columns: number }) {
  return (
    <>
      {Array.from({ length: 6 }, (_, row) => (
        <tr key={row} aria-hidden="true">
          {Array.from({ length: columns }, (_, column) => (
            <td className="px-3 py-4" key={column}>
              <SkeletonBlock
                className={column === 1 ? "h-4 w-40" : "h-4 w-14"}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

const MPASI_FOOD_FIELDS = [
  ["makananPokok", "Makanan pokok"],
  ["kacang", "Kacang"],
  ["susu", "Susu"],
  ["daging", "Daging"],
  ["telur", "Telur"],
  ["sayurVitA", "Vitamin A"],
  ["sayurLain", "Sayur lain"],
] as const;
const EMPTY_MPASI_LOG_MAP = new Map<string, Record<string, unknown>>();

type MpasiTableRowProps = {
  item: ChildrenPageResponse["items"][number];
  index: number;
  page: number;
  asOf: string;
  log?: Record<string, unknown>;
  showDesa: boolean;
  showPosyandu: boolean;
  isReadOnly: boolean;
  onOpenMpasi?: (child: Record<string, unknown>) => void;
  onSelectChild: (child: Record<string, unknown>) => void;
  onEditChild?: (child: Record<string, unknown>) => void;
  onOpenMeasurement?: (child: Record<string, unknown>) => void;
  onDeleteChild?: (child: Record<string, unknown>) => void;
};

/** Memoized MPASI row. Monitoring updates or modal state in the parent no
 * longer rebuild every visible child row when its item/log is unchanged. */
const MpasiTableRow = memo(function MpasiTableRow({
  item,
  index,
  page,
  asOf,
  log,
  showDesa,
  showPosyandu,
  isReadOnly,
  onOpenMpasi,
  onSelectChild,
  onEditChild,
  onOpenMeasurement,
  onDeleteChild,
}: MpasiTableRowProps) {
  const child = dataOf(item);
  const id = String(item.id || child.id || "");
  const childRecord = { ...child, id };
  const storedAge = child.ageInMonths ?? child.usiaBulan;
  const storedAgeNumber = Number(storedAge);
  const ageInMonths =
    getCompletedAgeInMonths(child.tglLahir || child.birthDate, asOf) ??
    (storedAge !== null && storedAge !== undefined && storedAge !== "" && Number.isFinite(storedAgeNumber)
      ? Math.trunc(storedAgeNumber)
      : null);
  return (
    <tr className="ios-data-row text-xs">
      <td className="whitespace-nowrap border-r border-slate-100 px-4 py-3 text-center text-slate-500 md:sticky md:left-0 md:z-10 md:bg-white">
        {(page - 1) * PAGE_SIZE + index + 1}
      </td>
      <td className="whitespace-nowrap border-r border-slate-100 px-4 py-3 md:sticky md:left-[48px] md:z-10 md:bg-white md:shadow-lg">
        <p className="font-bold text-slate-900">
          {display(child.nama || child.name)}
        </p>
        <p
          className={`font-mono text-[10px] ${
            child.hasNIK === true
              ? "text-slate-500"
              : "font-bold text-red-600"
          }`}
        >
          {display(child.nik || child.national_id)}
        </p>
        <div className="mt-1 flex items-center gap-1">
          <Badge color={child.jk === "L" || child.gender === "L" ? "blue" : "pink"}>
            {child.jk === "L" || child.gender === "L" ? "L" : "P"}
          </Badge>
          <span className="text-[10px] text-slate-400">
            {formatIndoDate(String(child.tglLahir || child.birthDate))} ({ageInMonths === null ? "-" : ageInMonths} Bln)
          </span>
        </div>
      </td>
      <td className="whitespace-nowrap border-r border-slate-100 px-4 py-3 text-slate-700">
        {display(child.namaOrtu || child.parentName)}
      </td>
      {showDesa ? (
        <td className="whitespace-nowrap border-r border-slate-100 px-4 py-3 text-slate-600">
          {display(child.desa || child.village)}
        </td>
      ) : null}
      {showPosyandu ? (
        <td className="whitespace-nowrap border-r border-slate-100 px-4 py-3 text-slate-600">
          {display(child.posyandu)}
        </td>
      ) : null}
      <td className="border-r border-slate-100 px-2 py-3 text-center text-[10px]">
        {log?.tglMonitoring ? formatIndoDate(String(log.tglMonitoring)) : "-"}
      </td>
      <td className="border-r border-slate-100 px-2 py-3 text-center text-[10px]">
        {log ? display(log.asi) : "-"}
      </td>
      {MPASI_FOOD_FIELDS.map(([key, label]) => (
        <td className="border-r border-slate-100 px-2 py-3 text-center text-[10px]" key={key}>
          {log ? (
            hasValue(log[key]) ? (
              "Ya"
            ) : (
              <span title={label} className="text-slate-400">Tidak</span>
            )
          ) : (
            <span title={label} className="text-slate-400">-</span>
          )}
        </td>
      ))}
      <td className="border-r border-slate-100 px-2 py-3 text-center text-[10px]">
        {log ? display(log.intervensiGizi) : "-"}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-center">
        <div className="flex justify-center gap-1">
          {onOpenMpasi ? (
            <button type="button" className="apple-button table-action-button table-action-orange" title="Input MPASI" aria-label="Input MPASI" onClick={() => onOpenMpasi(childRecord)}>
              <Utensils className="h-4 w-4" />
            </button>
          ) : null}
          {isReadOnly ? (
            <span className="text-xs font-semibold text-slate-400">Hanya baca</span>
          ) : (
            <>
              {!onOpenMpasi ? <AppButton variant="actionOrange" className="table-action-button table-action-orange" onClick={() => onSelectChild(childRecord)} title="Input MPASI"><Utensils className="h-4 w-4" /></AppButton> : null}
              {onEditChild ? <AppButton variant="actionBlue" className="table-action-button table-action-blue" onClick={() => onEditChild(childRecord)} title="Edit Identitas"><Pencil className="h-4 w-4" /></AppButton> : null}
              {onOpenMeasurement ? <AppButton variant="actionGreen" className="table-action-button table-action-cyan" onClick={() => onOpenMeasurement(childRecord)} title="Pengukuran Balita"><Ruler className="h-4 w-4" /></AppButton> : null}
              {onDeleteChild ? <AppButton variant="actionRed" className="table-action-button table-action-red" onClick={() => onDeleteChild(childRecord)} title="Hapus Balita"><Trash2 className="h-4 w-4" /></AppButton> : null}
            </>
          )}
        </div>
      </td>
    </tr>
  );
});

export type ReactMpasiPageProps = {
  user: DashboardUser;
  scope: Scope;
  onOpenAddChild?: () => void;
  onOpenMpasi?: (child: Record<string, unknown>) => void;
  onExportMpasi?: () => void;
  onEditChild?: (child: Record<string, unknown>) => void;
  onOpenMeasurement?: (child: Record<string, unknown>) => void;
  onDeleteChild?: (child: Record<string, unknown>) => void;
};

/** Read-only MPASI table. Age is fixed to the programme cohort 6–23 months. */
export default function ReactMpasiPage({
  user,
  scope,
  onOpenAddChild,
  onOpenMpasi,
  onExportMpasi,
  onEditChild,
  onOpenMeasurement,
  onDeleteChild,
}: ReactMpasiPageProps) {
  const [page, setPage] = useState(1);
  const tableViewportRef = useRef<HTMLDivElement>(null);
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("recent");
  const [nikStatus, setNikStatus] = useState<NikStatus>("all");
  const debouncedSearch = useDebouncedValue(search);
  const [selectedChild, setSelectedChild] = useState<Record<
    string,
    any
  > | null>(null);
  const request = useMemo(
    () => ({ ...requestOf(scope, user, page, debouncedSearch, nikStatus), sort }),
    [debouncedSearch, nikStatus, page, scope, sort, user],
  );
  const queryClient = useQueryClient();
  const pageQuery = useQuery({
    queryKey: ["children-page", request],
    queryFn: () => getChildrenPage(request),
    // Keep the fixed 6–23 month view consistent with the server response;
    // do not render rows from another month while this request is pending.
    staleTime: 0,
  });
  useEffect(
    () => setPage(1),
    [scope.month, scope.year, scope.desa, scope.posyandu, search, nikStatus],
  );
  const state: PageState<ChildrenPageResponse> = pageQuery.data
    ? { status: "success", data: pageQuery.data }
    : pageQuery.error
      ? {
          status: "error",
          message: errorMessage(
            pageQuery.error,
            "Data MPASI belum dapat dimuat.",
          ),
        }
      : { status: "loading" };
  const response = state.status === "success" ? state.data : null;
  const items = response?.items || [];
  const logs = useMemo(
    () => (response ? mpasiMap(response) : EMPTY_MPASI_LOG_MAP),
    [response],
  );
  const total = response?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const isMobileViewport = useIsMobileViewport();
  const tableColumnCount = 14 +
    (isFullAccessRole(user.role) ? 1 : 0) +
    (user.role === ROLES.BIDAN || isFullAccessRole(user.role) ? 1 : 0);
  const handleSelectChild = useCallback(
    (child: Record<string, unknown>) => setSelectedChild(child),
    [],
  );

  return (
    <div className="apple-page space-y-6" data-react-mpasi-page="true">
      {selectedChild ? (
        <MpasiModal
          child={selectedChild}
          onClose={() => setSelectedChild(null)}
          onSaved={() => {
            setPage(1);
            void queryClient.invalidateQueries({ queryKey: ["children-page"] });
          }}
        />
      ) : null}
      <section className="children-table-panel relative overflow-hidden rounded-[28px] border border-white/25 bg-white/40 p-4 shadow-[0_18px_48px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.65)] ring-1 ring-white/25 backdrop-blur-2xl backdrop-saturate-150 sm:p-5">
        <div className="children-table-panel-highlight" aria-hidden="true" />
        <div className="relative z-10 space-y-4">
          <div className="children-table-summary flex flex-col gap-3 rounded-[22px] bg-white/20 px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:px-4">
            <h2 className="apple-page-title">Balita MPASI (6-23 Bulan)</h2>
            <p className="text-sm text-slate-500">
              Menampilkan <span className="children-table-count-pill">{total}</span>{" "}
              balita usia 6-23 bulan untuk pemantauan MPASI.
            </p>
          </div>
          <div className="children-table-toolbar flex flex-col gap-3 rounded-[22px] border border-white/20 bg-white/20 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] lg:flex-row lg:items-center">
            <div className="flex w-full sm:w-72">
              <label className="sr-only" htmlFor="react-mpasi-search">
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
                  id="react-mpasi-search"
                  value={searchDraft}
                  onChange={(event) => {
                    setSearchDraft(event.target.value);
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Cari Nama / NIK..."
                  className="children-table-search-input min-h-11 w-full rounded-full border border-white/20 bg-white/50 py-2.5 pl-11 pr-8 text-sm text-slate-700 outline-none shadow-sm placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
                {searchDraft ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchDraft("");
                      setSearch("");
                      setPage(1);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 transition hover:bg-white/60 hover:text-slate-700"
                    aria-label="Hapus pencarian"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            </div>
            <div className="children-table-select-wrap relative w-full sm:w-52">
              <label className="sr-only" htmlFor="react-mpasi-sort">
                Urutkan data
              </label>
              <select
                id="react-mpasi-sort"
                value={sort}
                onChange={(event) => {
                  setSort(event.target.value);
                  setPage(1);
                }}
                className="children-table-select min-h-11 w-full appearance-none rounded-full border border-white/20 bg-white/50 py-2.5 pl-11 pr-9 text-sm text-slate-700 outline-none shadow-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              >
                <option value="recent">Terbaru Ditambahkan</option>
                <option value="oldest_input">Awal Diinput</option>
                <option value="name_asc">Nama (A-Z)</option>
                <option value="name_desc">Nama (Z-A)</option>
                <option value="age_oldest">Umur Tertua</option>
                <option value="age_youngest">Umur Termuda</option>
              </select>
              <span className="children-table-control-icon pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 rounded-full bg-blue-500/10 text-[#007aff]">
                <Filter className="h-4 w-4" strokeWidth={2.1} />
              </span>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>
            <div className="children-table-select-wrap relative w-full sm:w-52">
              <label className="sr-only" htmlFor="react-mpasi-nik-status">
                Filter NIK
              </label>
              <select
                id="react-mpasi-nik-status"
                value={nikStatus}
                onChange={(event) => {
                  setNikStatus(event.target.value as NikStatus);
                  setPage(1);
                }}
                className="children-table-select min-h-11 w-full appearance-none rounded-full border border-white/20 bg-white/50 py-2.5 pl-11 pr-9 text-sm text-slate-700 outline-none shadow-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              >
                {NIK_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <span className="children-table-control-icon pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 rounded-full bg-blue-500/10 text-[#007aff]">
                <Filter className="h-4 w-4" />
              </span>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>
            <div className="children-table-actions no-scrollbar flex min-w-0 gap-2 overflow-x-auto pb-1 sm:pb-0 lg:ml-auto">
              {onExportMpasi ? (
                <AppButton
                  type="button"
                  variant="ghost"
                  onClick={onExportMpasi}
                  className="children-table-action children-table-export-action children-table-export-action--table ios-toolbar-button icon-only-mobile whitespace-nowrap"
                  title="Export MPASI ke XLS"
                >
                  <span className="ios-button-symbol" aria-hidden="true">
                    <FileDown className="h-4 w-4" />
                  </span>
                  <span className="hidden sm:inline">Export MPASI</span>
                </AppButton>
              ) : null}
              {onOpenAddChild && user.accessMode !== "read" ? (
                <AppButton
                  type="button"
                  variant="primary"
                  onClick={onOpenAddChild}
                  className="children-table-action children-table-add-action ios-toolbar-button icon-only-mobile whitespace-nowrap"
                  title="Tambah balita"
                >
                  <span className="ios-button-symbol" aria-hidden="true">
                    <Plus className="h-4 w-4" />
                  </span>
                  <span className="hidden sm:inline">Tambah</span>
                </AppButton>
              ) : null}
            </div>
          </div>
          {state.status === "error" ? (
        <div
          role="alert"
          className="ios-inline-notification ios-inline-notification-error"
        >
          Gagal memuat data MPASI: {state.message}
        </div>
          ) : null}
          {isMobileViewport ? (
          <div className="mobile-children-list space-y-3 md:hidden" aria-label="Daftar balita MPASI">
            {state.status === "loading" ? (
              Array.from({ length: 4 }, (_, index) => (
                <div key={index} className="mobile-child-card rounded-2xl bg-white/40 p-4 space-y-2.5 backdrop-blur-xl ring-1 ring-white/25" aria-hidden="true">
                  <SkeletonBlock className="h-4 w-44" />
                  <SkeletonBlock className="h-3 w-32" />
                  <SkeletonBlock className="h-10 w-full rounded-xl" />
                </div>
              ))
            ) : items.length === 0 ? (
              <div className="mobile-child-card rounded-2xl bg-white/40 p-6 text-center text-sm text-slate-400 ring-1 ring-white/25">
                Tidak ada data MPASI pada kelompok usia 6-23 bulan.
              </div>
            ) : (
              items.map((item) => {
                const child = dataOf(item);
                const id = String(item.id || child.id || child.nik || "mpasi");
                const childRecord = { ...child, id };
                const log = logs.get(id);
                const foodsLogged = MPASI_FOOD_FIELDS.filter(([key]) => hasValue(log?.[key])).length;
                const open = onOpenMpasi || handleSelectChild;
                return (
                  <MobileProgramCard
                    key={id}
                    child={child}
                    asOf={request.asOf}
                    action={
                      <button
                        type="button"
                        className="mobile-child-more-button flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/20 text-blue-600 ring-1 ring-blue-300/60 transition hover:bg-blue-500/30 focus:outline-none focus:ring-2 focus:ring-blue-400"
                        onClick={() => open(childRecord)}
                        title="Buka aksi MPASI"
                        aria-label={`Buka aksi MPASI ${String(child.nama || child.name || "balita")}`}
                      >
                        <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                      </button>
                    }
                  >
                    <div className="grid grid-cols-3 gap-2">
                      <div className="mobile-child-measurement-cell">
                        <span>Monitor</span>
                        <strong>{log?.tglMonitoring ? formatIndoDate(String(log.tglMonitoring)) : "—"}</strong>
                      </div>
                      <div className={`mobile-child-status ${log && hasValue(log.asi) ? "mobile-child-status--good" : "mobile-child-status--empty"}`}>
                        <span className="mobile-child-status-label">ASI</span>
                        <span className="mobile-child-status-value">{log ? (hasValue(log.asi) ? "Ya" : "Tidak") : "—"}</span>
                      </div>
                      <div className={`mobile-child-status ${foodsLogged > 0 ? "mobile-child-status--good" : "mobile-child-status--empty"}`}>
                        <span className="mobile-child-status-label">Menu</span>
                        <span className="mobile-child-status-value">{log ? `${foodsLogged}/7` : "—"}</span>
                      </div>
                    </div>
                    {log?.intervensiGizi ? (
                      <p className="mt-2 truncate text-[11px] text-slate-500" title={String(log.intervensiGizi)}>
                        Intervensi: {String(log.intervensiGizi)}
                      </p>
                    ) : null}
                  </MobileProgramCard>
                );
              })
            )}
          </div>
          ) : null}
          {!isMobileViewport ? (
          <div className="hidden md:block">
          <Card className="ios-table-card children-table-card program-table-card overflow-hidden">
        <DataTable
          ref={tableViewportRef}
          className="program-table-scroll"
          ariaLabel="Daftar MPASI React"
        >
          <table className="ios-data-table ios-children-table min-w-full">
            <thead className="bg-slate-50 text-left font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="border-r border-slate-200 px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">No</th>
                <th className="border-r border-slate-200 px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">Identitas</th>
                <th className="border-r border-slate-200 px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">Ortu</th>
                {isFullAccessRole(user.role) ? <th className="border-r border-slate-200 px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">Desa</th> : null}
                {user.role === ROLES.BIDAN || isFullAccessRole(user.role) ? <th className="border-r border-slate-200 px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">Posyandu</th> : null}
                {["Tgl Monitor", "ASI", "Mkn Pokok", "Kacang", "Susu", "Daging", "Telur", "Vit A", "Sayur Lain", "Intervensi"].map((heading) => (
                  <th className="border-r border-slate-200 bg-orange-50/50 px-2 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500" key={heading}>{heading}</th>
                ))}
                <th className="px-4 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {state.status === "loading" ? (
                <TableSkeleton columns={tableColumnCount} />
              ) : items.length === 0 ? (
                <tr>
                  <td
                    colSpan={14 + (isFullAccessRole(user.role) ? 1 : 0) + (user.role === ROLES.BIDAN || isFullAccessRole(user.role) ? 1 : 0)}
                    className="px-6 py-12 text-center text-slate-400"
                  >
                    Tidak ada data MPASI pada kelompok usia 6-23 bulan.
                  </td>
                </tr>
              ) : (
                items.map((item, index) => {
                  const id = String(item.id || dataOf(item).id || "");
                  return (
                    <MpasiTableRow
                      key={id || index}
                      item={item}
                      index={index}
                      page={page}
                      asOf={request.asOf}
                      log={logs.get(id)}
                      showDesa={isFullAccessRole(user.role)}
                      showPosyandu={user.role === ROLES.BIDAN || isFullAccessRole(user.role)}
                      isReadOnly={user.accessMode === "read"}
                      onOpenMpasi={onOpenMpasi}
                      onSelectChild={handleSelectChild}
                      onEditChild={onEditChild}
                      onOpenMeasurement={onOpenMeasurement}
                      onDeleteChild={onDeleteChild}
                    />
                  );
                })
              )}
            </tbody>
          </table>
        </DataTable>
        <HorizontalTableScrollbar
          viewportRef={tableViewportRef}
          refreshKey={`${state.status}-${items.length}-${scope.month}-${scope.year}`}
        />
        <div className="ios-table-footer flex flex-col items-center justify-between gap-4 sm:flex-row">
          <span className="text-xs font-medium text-slate-500">
            Menampilkan {total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1} -{" "}
            {Math.min(page * PAGE_SIZE, total)} dari {total} data
          </span>
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            disablePrevious={state.status === "loading" || page <= 1}
            disableNext={
              state.status === "loading" || page >= totalPages || total === 0
            }
            onPrevious={() => setPage((current) => Math.max(1, current - 1))}
            onNext={() =>
              setPage((current) => Math.min(totalPages, current + 1))
            }
          />
        </div>
          </Card>
          </div>
          ) : null}
          {isMobileViewport ? (
          <div className="ios-table-footer flex items-center justify-between gap-3 md:hidden">
            <span className="text-xs font-medium text-slate-500">
              Menampilkan {total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1} - {Math.min(page * PAGE_SIZE, total)} dari {total} data
            </span>
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              disablePrevious={state.status === "loading" || page <= 1}
              disableNext={state.status === "loading" || page >= totalPages || total === 0}
              onPrevious={() => setPage((current) => Math.max(1, current - 1))}
              onNext={() => setPage((current) => Math.min(totalPages, current + 1))}
            />
          </div>
          ) : null}
        </div>
      </section>
      {selectedChild ? (
        <MpasiModal
          child={selectedChild}
          onClose={() => setSelectedChild(null)}
          onSaved={() => setSelectedChild(null)}
        />
      ) : null}
    </div>
  );
}
