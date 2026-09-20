// SPDX-License-Identifier: GPL-3.0-or-later


import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getExclusiveBreastfeedingPage,
  type ExclusiveBreastfeedingPageResponse,
} from "../../api/childrenApi";
import { isFullAccessRole, MONTHS } from "../../config/dashboard";
import { formatIndoDate } from "../../shared/formatters";
import { errorMessage, type PageState } from "../../shared/pageState";
import { type AgeGroup } from "../../config/ageFilters";
import type { DashboardUser } from "../../types";
import {
  AppButton,
  Card,
  DataTable,
  HorizontalTableScrollbar,
  Pagination,
  SkeletonBlock,
} from "../../components/base";
import MobileProgramCard from "../../components/data-display/MobileProgramCard";
import {
  CheckCircle2,
  ChevronDown,
  FileDown,
  FileText,
  Filter,
  Search,
  X,
} from "../../ui/icons";
import {
  NIK_STATUS_OPTIONS,
  childMatchesNikStatus,
  type NikStatus,
} from "../../config/nikFilters";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { useIsMobileViewport } from "../../hooks/useMediaQuery";

type Scope = {
  month: number;
  year: number;
  ageGroup: AgeGroup;
  desa?: string | null;
  posyandu?: string | null;
};

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
function dataOf(item: Record<string, unknown>) {
  return (
    item.data && typeof item.data === "object" ? item.data : item
  ) as Record<string, unknown>;
}

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 6 }, (_, row) => (
        <tr key={row} aria-hidden="true">
          {Array.from({ length: 6 }, (_, column) => (
            <td className="px-4 py-4" key={column}>
              <SkeletonBlock
                className={column === 1 ? "h-4 w-40" : "h-4 w-16"}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

type BreastfeedingRowProps = {
  item: ExclusiveBreastfeedingPageResponse["items"][number];
  index: number;
  page: number;
};

const BreastfeedingRow = memo(function BreastfeedingRow({
  item,
  index,
  page,
}: BreastfeedingRowProps) {
  const child = dataOf(item);
  return (
    <tr className="text-slate-700 hover:bg-slate-50">
      <td className="px-4 py-3 text-center text-slate-500">
        {(page - 1) * 10 + index + 1}
      </td>
      <td className="px-4 py-3">
        <p className="font-semibold text-slate-800">{display(child.nama)}</p>
        <p className={`font-mono text-xs ${child.hasNIK !== true ? "font-bold text-red-600" : "text-slate-500"}`}>
          {display(child.nik || child.national_id)}
        </p>
      </td>
      <td className="px-4 py-3">{display(child.ageInMonths)} bulan</td>
      <td className="px-4 py-3">
        {child.tglUkur ? formatIndoDate(String(child.tglUkur)) : "-"}
      </td>
      <td className="px-4 py-3">
        <p>{display(child.posyandu)}</p>
        <p className="text-xs text-slate-500">{display(child.desa)}</p>
      </td>
      <td className="px-4 py-3 text-center">
        <span className="ios-status-pill ios-status-success inline-flex items-center gap-1.5 text-xs font-bold">
          <CheckCircle2 className="h-4 w-4" />
          Ya
        </span>
      </td>
    </tr>
  );
});

export type ReactExclusiveBreastfeedingPageProps = {
  user: DashboardUser;
  scope: Scope;
  onExportTable?: () => void;
  onExportMeasurement?: () => void;
};

/** React-owned ASI page. The programme cohort is fixed at exactly six months. */
export default function ReactExclusiveBreastfeedingPage({
  user,
  scope,
  onExportTable,
  onExportMeasurement,
}: ReactExclusiveBreastfeedingPageProps) {
  const [page, setPage] = useState(1);
  const tableViewportRef = useRef<HTMLDivElement>(null);
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("recent");
  const [nikStatus, setNikStatus] = useState<NikStatus>("all");
  const debouncedSearch = useDebouncedValue(search);
  const ageGroup: AgeGroup = "6";
  const village = isFullAccessRole(user.role)
    ? scope.desa || undefined
    : user.desa || undefined;
  const posyandu =
    user.role === "Kader Posyandu"
      ? user.posyandu || undefined
      : scope.posyandu || undefined;
  const request = useMemo(
    () => ({
      ageGroup,
      historyStart: "1900-01-01",
      measurementStart: dateStart(scope.year, scope.month),
      measurementEnd: dateEnd(scope.year, scope.month),
      page,
      size: 10,
      village,
      posyandu,
    }),
    [
      ageGroup,
      page,
      posyandu,
      scope.month,
      scope.year,
      scope.posyandu,
      scope.desa,
      village,
    ],
  );

  useEffect(() => {
    setPage(1);
  }, [scope.ageGroup, scope.month, scope.year, scope.desa, scope.posyandu]);
  const pageQuery = useQuery({
    queryKey: ["exclusive-breastfeeding-page", request],
    queryFn: () => getExclusiveBreastfeedingPage(request),
    // A cohort or period change must wait for the matching response instead
    // of briefly painting the previous page's rows.
    staleTime: 0,
  });
  const state: PageState<ExclusiveBreastfeedingPageResponse> = pageQuery.data
    ? { status: "success", data: pageQuery.data }
    : pageQuery.error
      ? {
          status: "error",
          message: errorMessage(
            pageQuery.error,
            "Data ASI eksklusif belum dapat dimuat.",
          ),
        }
      : { status: "loading" };

  const items = state.status === "success" ? state.data.items : [];
  const total = state.status === "success" ? state.data.total : 0;
  const visibleItems = useMemo(() => {
    const needle = debouncedSearch.trim().toLowerCase();
    const filtered = items.filter((item) => {
      const child = dataOf(item);
      const haystack = [child.nama, child.nik, child.national_id]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return (
        (!needle || haystack.includes(needle)) &&
        childMatchesNikStatus(child, nikStatus)
      );
    });
    return [...filtered].sort((left, right) => {
      const a = dataOf(left);
      const b = dataOf(right);
      if (sort === "name_asc" || sort === "name_desc") {
        const result = String(a.nama || "").localeCompare(String(b.nama || ""), "id");
        return sort === "name_desc" ? -result : result;
      }
      if (sort === "age_oldest" || sort === "age_youngest") {
        const result = Number(a.ageInMonths || 0) - Number(b.ageInMonths || 0);
        return sort === "age_oldest" ? -result : result;
      }
      const result = String(a.tglUkur || "").localeCompare(String(b.tglUkur || ""));
      return sort === "recent" ? -result : result;
    });
  }, [debouncedSearch, items, nikStatus, sort]);
  const hasLocalFilter = Boolean(debouncedSearch.trim()) || nikStatus !== "all";
  const displayedItems = visibleItems;
  const displayedTotal = hasLocalFilter ? displayedItems.length : total;
  const totalPages = hasLocalFilter ? 1 : Math.max(1, Math.ceil(total / 10));
  const isMobileViewport = useIsMobileViewport();
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, nikStatus, sort]);
  return (
    <div
      className="apple-page space-y-6"
      data-react-asi-page="true"
      aria-busy={state.status === "loading" ? "true" : "false"}
    >
      <section className="children-table-panel relative overflow-hidden rounded-[28px] border border-white/25 bg-white/40 p-4 shadow-[0_18px_48px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.65)] ring-1 ring-white/25 backdrop-blur-2xl backdrop-saturate-150 sm:p-5">
        <div className="children-table-panel-highlight" aria-hidden="true" />
        <div className="relative z-10 space-y-4">
          <div className="children-table-summary flex flex-col gap-3 rounded-[22px] bg-white/20 px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:px-4">
            <h2 className="apple-page-title">Daftar ASI Eksklusif</h2>
            <p className="text-sm text-slate-500">
              Menampilkan <span className="children-table-count-pill">{displayedTotal}</span>{" "}
              bayi · {MONTHS[scope.month - 1]} {scope.year}
            </p>
          </div>
          <div className="children-table-toolbar flex flex-col gap-3 rounded-[22px] border border-white/20 bg-white/20 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] lg:flex-row lg:items-center">
            <div className="flex w-full sm:w-72">
              <label className="sr-only" htmlFor="react-asi-search">
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
                  id="react-asi-search"
                  value={searchDraft}
                  onChange={(event) => {
                    setSearchDraft(event.target.value);
                    setSearch(event.target.value);
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
              <label className="sr-only" htmlFor="react-asi-sort">
                Urutkan data
              </label>
              <select
                id="react-asi-sort"
                value={sort}
                onChange={(event) => setSort(event.target.value)}
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
                <Filter className="h-4 w-4" />
              </span>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>
            <div className="children-table-select-wrap relative w-full sm:w-52">
              <label className="sr-only" htmlFor="react-asi-nik-status">
                Filter NIK
              </label>
              <select
                id="react-asi-nik-status"
                value={nikStatus}
                onChange={(event) =>
                  setNikStatus(event.target.value as NikStatus)
                }
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
              {onExportTable ? (
                <AppButton
                  type="button"
                  variant="ghost"
                  className="children-table-action children-table-export-action children-table-export-action--table asi-toolbar-action ios-toolbar-button whitespace-nowrap"
                  onClick={onExportTable}
                  title="Export tabel ASI eksklusif"
                >
                  <span className="ios-button-symbol" aria-hidden="true">
                    <FileText className="h-4 w-4" />
                  </span>
                  <span className="asi-toolbar-action-label">Export Tabel</span>
                </AppButton>
              ) : null}
              {onExportMeasurement ? (
                <AppButton
                  type="button"
                  variant="ghost"
                  className="children-table-action children-table-export-action children-table-export-action--measurement asi-toolbar-action ios-toolbar-button whitespace-nowrap"
                  onClick={onExportMeasurement}
                  title="Export pengukuran ASI"
                >
                  <span className="ios-button-symbol" aria-hidden="true">
                    <FileDown className="h-4 w-4" />
                  </span>
                  <span className="asi-toolbar-action-label">Export Pengukuran</span>
                </AppButton>
              ) : null}
            </div>
          </div>
          {state.status === "error" ? (
            <div
              role="alert"
              className="ios-inline-notification ios-inline-notification-error"
            >
              Gagal memuat data ASI eksklusif: {state.message}
            </div>
          ) : null}
          {isMobileViewport ? (
          <div className="mobile-children-list space-y-3 md:hidden" aria-label="Daftar balita ASI eksklusif">
            {state.status === "loading" ? (
              Array.from({ length: 4 }, (_, index) => (
                <div key={index} className="mobile-child-card rounded-2xl bg-white/40 p-4 space-y-2.5 backdrop-blur-xl ring-1 ring-white/25" aria-hidden="true">
                  <SkeletonBlock className="h-4 w-44" />
                  <SkeletonBlock className="h-3 w-32" />
                  <SkeletonBlock className="h-10 w-full rounded-xl" />
                </div>
              ))
            ) : displayedItems.length === 0 ? (
              <div className="mobile-child-card rounded-2xl bg-white/40 p-6 text-center text-sm text-slate-400 ring-1 ring-white/25">
                Tidak ada data ASI eksklusif pada kelompok usia ini.
              </div>
            ) : (
              displayedItems.map((item) => {
                const child = dataOf(item);
                const key = String(item.id || child.id || child.nik || "asi");
                return (
                  <MobileProgramCard key={key} child={child} asOf={dateEnd(scope.year, scope.month)}>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="mobile-child-measurement-cell">
                        <span>Tanggal ukur</span>
                        <strong>{child.tglUkur ? formatIndoDate(String(child.tglUkur)) : "—"}</strong>
                      </div>
                      <div className="mobile-child-status mobile-child-status--good">
                        <span className="mobile-child-status-label">ASI eksklusif</span>
                        <span className="mobile-child-status-value">Ya</span>
                      </div>
                    </div>
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
              ariaLabel="Daftar ASI eksklusif React"
            >
              <table
                className="ios-data-table ios-asi-table min-w-full text-sm"
                aria-busy={state.status === "loading" ? "true" : "false"}
              >
                <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    {[
                      "No.",
                      "Balita",
                      "Usia",
                      "Tanggal Ukur",
                      "Lokasi",
                      "ASI Eksklusif",
                    ].map((heading, index) => (
                      <th
                        className={`px-4 py-3 ${index === 0 ? "w-16 text-center" : ""}`}
                        key={heading}
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {state.status === "loading" ? (
                    <TableSkeleton />
                  ) : displayedItems.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-6 py-12 text-center text-slate-400"
                      >
                        Tidak ada data ASI eksklusif pada kelompok usia ini.
                      </td>
                    </tr>
                  ) : (
                    displayedItems.map((item, index) => (
                      <BreastfeedingRow
                        key={String(item.id || index)}
                        item={item}
                        index={index}
                        page={page}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </DataTable>
            <HorizontalTableScrollbar
              viewportRef={tableViewportRef}
              refreshKey={`${state.status}-${displayedItems.length}-${scope.month}-${scope.year}-${ageGroup}`}
            />
            <div className="ios-table-footer flex flex-col items-center justify-between gap-4 sm:flex-row">
              <span className="text-xs font-medium text-slate-500">
                Menampilkan {displayedTotal === 0 ? 0 : (page - 1) * 10 + 1} -{" "}
                {Math.min(page * 10, displayedTotal)} dari {displayedTotal} data
              </span>
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                disablePrevious={state.status === "loading" || page <= 1}
                disableNext={
                  state.status === "loading" ||
                  page >= totalPages ||
                  displayedTotal === 0
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
              Menampilkan {displayedTotal === 0 ? 0 : (page - 1) * 10 + 1} - {Math.min(page * 10, displayedTotal)} dari {displayedTotal} data
            </span>
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              disablePrevious={state.status === "loading" || page <= 1}
              disableNext={state.status === "loading" || page >= totalPages || displayedTotal === 0}
              onPrevious={() => setPage((current) => Math.max(1, current - 1))}
              onNext={() => setPage((current) => Math.min(totalPages, current + 1))}
            />
          </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
