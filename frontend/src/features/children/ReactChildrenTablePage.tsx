// Copyright (C) 2026 Johandi Arifiansyach

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getChildrenPage,
  type ChildrenPageRequest,
  type ChildrenPageResponse,
} from "../../api/childrenApi";
import { DEFAULT_AGE_GROUP, type AgeGroup } from "../../config/ageFilters";
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
  StatusBadge,
  KenaikanBadge,
  statusBadgeTone,
} from "../../components/base";
import {
  doc,
  serverTimestamp,
  syncPendingMutations,
  updateDoc,
} from "../../api/syncApi";
import { appId, db } from "../../app/session";
import DeleteChildModal from "./DeleteChildModal";
import {
  ChevronDown,
  FileDown,
  FileText,
  FileUp,
  Filter,
  Gift,
  Pencil,
  Plus,
  Ruler,
  RotateCcw,
  Search,
  Trash2,
  Utensils,
  X,
} from "../../ui/icons";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { useIsMobileViewport } from "../../hooks/useMediaQuery";
import {
  NIK_STATUS_OPTIONS,
  childHasManualNik,
  type NikStatus,
} from "../../config/nikFilters";

type Scope = {
  month: number;
  year: number;
  ageGroup: AgeGroup;
  desa?: string | null;
  posyandu?: string | null;
};

const PAGE_SIZE = 10;
type ChildView = NonNullable<ChildrenPageRequest["view"]>;
const EMPTY_MEASUREMENT: Record<string, unknown> = {};
const EMPTY_MEASUREMENT_MAP = new Map<string, Record<string, unknown>>();

/** Keep the page heading identical to the legacy table, including the
 * programme context shown for each problem tab.  The tab labels are short,
 * while the legacy heading is deliberately descriptive for printed/exported
 * views. */
function pageHeading(view: ChildView, month: number, year: number) {
  if (view === "recycle") return "Daftar Sampah (Recycle Bin)";
  if (view === "recent") return `Balita Baru (${MONTHS[month - 1]} ${year})`;
  if (view === "problem_underweight") return "Daftar Balita Underweight (BB/U)";
  if (view === "problem_stunting") return "Daftar Balita Stunting (TB/U)";
  if (view === "problem_wasting") return "Daftar Balita Wasting (BB/TB)";
  if (view === "problem_tidak_naik") return "Daftar Balita Tidak Naik (T)";
  return "Data Balita Lengkap";
}

function dateStart(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

function dateEnd(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(new Date(year, month, 0).getDate()).padStart(2, "0")}`;
}

function previousRange(year: number, month: number) {
  const previous = new Date(year, month - 2, 1);
  return { year: previous.getFullYear(), month: previous.getMonth() + 1 };
}

function toRequest(
  scope: Scope,
  user: DashboardUser,
  page: number,
  search: string,
  sort: string,
  nikStatus: NikStatus,
  view: ChildView,
): ChildrenPageRequest {
  const previous = previousRange(scope.year, scope.month);
  const village = isFullAccessRole(user.role)
    ? scope.desa || undefined
    : user.desa || undefined;
  const posyandu =
    user.role === "Kader Posyandu"
      ? user.posyandu || undefined
      : scope.posyandu || undefined;
  return {
    asOf: dateEnd(scope.year, scope.month),
    ageGroup: scope.ageGroup,
    measurementStart: dateStart(scope.year, scope.month),
    measurementEnd: dateEnd(scope.year, scope.month),
    previousMonthStart: dateStart(previous.year, previous.month),
    previousMonthEnd: dateEnd(previous.year, previous.month),
    historyStart: "1900-01-01",
    page,
    nikStatus,
    size: PAGE_SIZE,
    sort,
    view,
    search: search.trim() || undefined,
    village,
    posyandu,
  };
}

function value(
  data: Record<string, unknown>,
  ...keys: string[]
): string | number {
  for (const key of keys) {
    const current = data[key];
    if (current !== null && current !== undefined && current !== "") {
      if (typeof current === "string" || typeof current === "number")
        return current;
      if (typeof current === "boolean") return current ? "Ya" : "Tidak";
      try {
        return JSON.stringify(current) || "-";
      } catch {
        return String(current);
      }
    }
  }
  return "-";
}

function dataOf(
  item: { data?: Record<string, unknown> } & Record<string, unknown>,
) {
  return (
    item.data && typeof item.data === "object" ? item.data : item
  ) as Record<string, unknown>;
}

function measurementMap(response: ChildrenPageResponse) {
  const result = new Map<string, Record<string, unknown>>();
  for (const item of response.measurements || []) {
    const data = dataOf(item);
    const childId = String(value(data, "childId", "child_id"));
    if (!childId || childId === "-") continue;
    const current = result.get(childId);
    const currentDate = new Date(
      String(value(data, "tglUkur", "measurementDate", "date")),
    ).getTime();
    const previousDate = current
      ? new Date(
          String(value(current, "tglUkur", "measurementDate", "date")),
        ).getTime()
      : -1;
    if (
      !current ||
      (Number.isFinite(currentDate) && currentDate >= previousDate)
    )
      result.set(childId, data);
  }
  return result;
}

function TableSkeleton({
  rows = 6,
  columns = 12,
}: {
  rows?: number;
  columns?: number;
}) {
  return (
    <>
      {Array.from({ length: rows }, (_, row) => (
        <tr key={row} aria-hidden="true">
          {Array.from({ length: columns }, (_, column) => (
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

type MobileChildCardProps = {
  item: ChildrenPageResponse["items"][number];
  page: number;
  index: number;
  view: ChildView;
  asOf: string;
  measurement: Record<string, unknown>;
  isReadOnly: boolean;
  onOpenMeasurement?: (child: Record<string, unknown>) => void;
  onEditChild?: (child: Record<string, unknown>) => void;
  onOpenPmt?: (child: Record<string, unknown>, category: string) => void;
  onRestoreChild?: (child: Record<string, unknown>) => void;
  onPermanentDelete?: (child: Record<string, unknown>) => void;
  onDeleteRequest: (child: Record<string, unknown>) => void;
};

type MobileStatusKind = "nutrition" | "weight-gain";

function mobileStatusTone(status: string, kind: MobileStatusKind = "nutrition") {
  if (kind === "weight-gain") {
    const key = status.trim().toUpperCase();
    if (!key || key === "-") return "empty";
    // Keep N/T/B/O in lockstep with KenaikanBadge used by the desktop table.
    if (key.startsWith("N")) return "gain-good";
    if (key.startsWith("T")) return "gain-risk";
    if (key.startsWith("B")) return "gain-new";
    if (key.startsWith("O")) return "gain-neutral";
    return "gain-neutral";
  }
  return statusBadgeTone(status);
}

function MobileStatusChip({
  label,
  status,
  loading = false,
  kind = "nutrition",
}: {
  label: string;
  status: string;
  loading?: boolean;
  kind?: MobileStatusKind;
}) {
  const tone = mobileStatusTone(status, kind);
  return (
    <span
      className={`mobile-child-status mobile-child-status--${tone}`}
      title={`${label}: ${status === "-" ? "Belum tersedia" : status}`}
    >
      <span className="mobile-child-status-label">{label}</span>
      {loading ? (
        <SkeletonBlock className="mobile-child-status-skeleton" />
      ) : (
        <span className="mobile-child-status-value">{status === "-" ? "—" : status}</span>
      )}
    </span>
  );
}

function MobileMeasurementCell({
  label,
  measurementValue,
  unit,
}: {
  label: string;
  measurementValue: string | number;
  unit: string;
}) {
  return (
    <div className="mobile-child-measurement-cell">
      <span>{label}</span>
      <strong>{measurementValue === "-" ? "—" : measurementValue}</strong>
      <small>{unit}</small>
    </div>
  );
}

/** WHO convention for the length/height field on compact mobile cards:
 * children through 23 months are measured by recumbent length (PB), while
 * children from 24 months onward are measured standing (TB). */
function mobileLengthLabel(ageInMonths: number | null) {
  if (ageInMonths !== null && ageInMonths >= 0 && ageInMonths < 24) return "PB";
  if (ageInMonths !== null && ageInMonths >= 24) return "TB";
  return "PB/TB";
}

function mobileLengthStatusLabels(ageInMonths: number | null) {
  if (ageInMonths !== null && ageInMonths >= 0 && ageInMonths < 24) {
    return { tbu: "PB/U", bbtb: "BB/PB" };
  }
  if (ageInMonths !== null && ageInMonths >= 24) {
    return { tbu: "TB/U", bbtb: "BB/TB" };
  }
  return { tbu: "PB/TB-U", bbtb: "BB/PB atau BB/TB" };
}

function mobileLengthValue(
  measurement: Record<string, unknown>,
  ageInMonths: number | null,
) {
  if (ageInMonths !== null && ageInMonths >= 0 && ageInMonths < 24) {
    return value(measurement, "pb", "tb", "height");
  }
  return value(measurement, "tb", "pb", "height");
}

const MobileChildCard = memo(function MobileChildCard({
  item,
  page,
  index,
  view,
  asOf,
  measurement,
  isReadOnly,
  onOpenMeasurement,
  onEditChild,
  onOpenPmt,
  onRestoreChild,
  onPermanentDelete,
  onDeleteRequest,
}: MobileChildCardProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const child = dataOf(item);
  const id = String(item.id || value(child, "id"));
  const childRecord = { ...child, id };
  const storedAge = value(child, "ageInMonths", "usiaBulan");
  const measurementAge = value(measurement, "ageInMonths", "usiaBulan");
  const storedAgeNumber = Number(storedAge);
  const measurementAgeNumber = Number(measurementAge);
  const birthDate = value(child, "tglLahir", "birthDate", "birth_date");
  const ageInMonths =
    getCompletedAgeInMonths(birthDate, asOf) ??
    (storedAge !== "-" && Number.isFinite(storedAgeNumber)
      ? Math.trunc(storedAgeNumber)
      : measurementAge !== "-" && Number.isFinite(measurementAgeNumber)
        ? Math.trunc(measurementAgeNumber)
        : null);
  const analysisLoading = false;
  const status = (key: string, ...aliases: string[]) =>
    String(value(measurement, key, ...aliases));
  const gender = String(value(child, "jk", "gender"));
  const parent = String(value(child, "namaOrtu", "parentName"));
  const village = String(value(child, "desa", "village"));
  const posyandu = String(value(child, "posyandu"));
  const location = [village, posyandu].filter((part) => part && part !== "-").join(" / ");
  const relation = [
    `Ortu: ${parent === "-" ? "—" : parent}`,
    location,
  ].filter(Boolean).join(" · ");
  const lengthStatusLabels = mobileLengthStatusLabels(ageInMonths);

  return (
    <article className="mobile-child-card rounded-2xl bg-white/40 p-4 space-y-2.5 backdrop-blur-xl ring-1 ring-white/25">
      <div className="mobile-child-identity flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-slate-900">
            {value(child, "nama", "name")}
          </p>
          <p
            className={`truncate font-mono text-[10px] ${
              childHasManualNik(child) ? "text-slate-500" : "font-bold text-red-600"
            }`}
          >
            {value(child, "nik", "national_id")}
          </p>
          <div className="mt-1 flex items-center gap-1.5">
            <Badge color={gender === "L" ? "blue" : "pink"}>{gender === "L" ? "L" : "P"}</Badge>
            <span className="truncate rounded-full bg-white/45 px-2 py-0.5 text-[10px] font-medium text-slate-600 ring-1 ring-white/30">
              {ageInMonths === null ? "—" : `${ageInMonths} bln`}
            </span>
          </div>
        </div>
        <div className="mobile-child-actions" aria-label="Aksi balita">
          {isReadOnly ? (
            <span className="px-1 text-[10px] font-semibold text-slate-400">Hanya baca</span>
          ) : view === "recycle" ? (
            <>
              {onRestoreChild ? (
                <button
                  type="button"
                  className="apple-button table-action-button table-action-green"
                  title="Pulihkan"
                  aria-label="Pulihkan balita"
                  onClick={() => onRestoreChild(childRecord)}
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
              ) : null}
              {onPermanentDelete ? (
                <button
                  type="button"
                  className="apple-button table-action-button table-action-red"
                  title="Hapus Permanen"
                  aria-label="Hapus permanen"
                  onClick={() => onPermanentDelete(childRecord)}
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </>
          ) : (
            <>
              {onOpenPmt && ["problem_wasting", "problem_underweight", "problem_tidak_naik"].includes(view) ? (
                <button
                  type="button"
                  className="apple-button table-action-button table-action-pmt"
                  title="Beri PMT"
                  aria-label="Beri PMT"
                  onClick={() => onOpenPmt(childRecord, view)}
                >
                  <Gift className="h-4 w-4" />
                </button>
              ) : null}
              {onEditChild ? (
                <button
                  type="button"
                  className="apple-button table-action-button table-action-blue"
                  title="Edit Identitas"
                  aria-label="Edit Identitas"
                  onClick={() => onEditChild(childRecord)}
                >
                  <Pencil className="h-4 w-4" />
                </button>
              ) : null}
              {onOpenMeasurement ? (
                <button
                  type="button"
                  className="apple-button table-action-button table-action-cyan"
                  title="Pengukuran Balita"
                  aria-label="Pengukuran Balita"
                  onClick={() => onOpenMeasurement(childRecord)}
                >
                  <Ruler className="h-4 w-4" />
                </button>
              ) : null}
              <button
                type="button"
                className="apple-button table-action-button table-action-red"
                title="Hapus Balita"
                aria-label="Hapus Balita"
                onClick={() => onDeleteRequest(childRecord)}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </div>

      <p className="mobile-child-relation truncate text-[11px] text-slate-500" title={relation}>
        {relation}
      </p>
      {view === "recycle" && value(child, "deleteReason", "alasanDihapus") !== "-" ? (
        <p className="truncate text-[10px] font-medium text-rose-600">
          Alasan dihapus: {value(child, "deleteReason", "alasanDihapus")}
        </p>
      ) : null}

      <div className="mobile-child-measurements grid grid-cols-4 gap-2 text-center">
        <MobileMeasurementCell label="BB" measurementValue={value(measurement, "bb", "weight")} unit="kg" />
        <MobileMeasurementCell label={mobileLengthLabel(ageInMonths)} measurementValue={mobileLengthValue(measurement, ageInMonths)} unit="cm" />
        <MobileMeasurementCell label="LILA" measurementValue={value(measurement, "lila", "muac")} unit="cm" />
        <MobileMeasurementCell label="LK" measurementValue={value(measurement, "lk", "headCircumference")} unit="cm" />
      </div>

      <div className="mobile-child-status-grid grid grid-cols-3 gap-2">
        <MobileStatusChip label="BB/U" status={status("bbuStatus", "statusBbu")} loading={analysisLoading} />
        <MobileStatusChip label={lengthStatusLabels.tbu} status={status("tbuStatus", "statusTbu")} loading={analysisLoading} />
        <MobileStatusChip label={lengthStatusLabels.bbtb} status={status("bbtbStatus", "statusBbtb")} loading={analysisLoading} />
      </div>

      <button
        type="button"
        className="mobile-child-details-toggle inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 transition hover:text-blue-600"
        aria-expanded={detailsOpen}
        onClick={() => setDetailsOpen((current) => !current)}
      >
        {detailsOpen ? "Sembunyikan detail" : "Lihat detail"}
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${detailsOpen ? "rotate-180" : ""}`} />
      </button>
      {detailsOpen ? (
        <div className="mobile-child-derived-status grid grid-cols-2 gap-2">
          <MobileStatusChip label="Kenaikan" status={status("weightGainStatus", "statusNaik")} kind="weight-gain" loading={analysisLoading} />
          <MobileStatusChip label="IMT/U" status={status("imtuStatus", "statusImtu")} loading={analysisLoading} />
        </div>
      ) : null}
    </article>
  );
});

function MobileChildCardSkeleton() {
  return (
    <div className="mobile-child-card rounded-2xl bg-white/40 p-4 space-y-2.5 backdrop-blur-xl ring-1 ring-white/25" aria-hidden="true">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <SkeletonBlock className="h-4 w-44" />
          <SkeletonBlock className="h-3 w-32" />
        </div>
        <SkeletonBlock className="h-8 w-8 rounded-full" />
      </div>
      <SkeletonBlock className="h-3 w-3/4" />
      <div className="grid grid-cols-4 gap-2">
        {Array.from({ length: 4 }, (_, index) => <SkeletonBlock key={index} className="h-12 rounded-xl" />)}
      </div>
      <SkeletonBlock className="h-8 w-full rounded-xl" />
    </div>
  );
}

type MobileChildActionSheetProps = {
  child: Record<string, unknown>;
  view: ChildView;
  isReadOnly: boolean;
  reducedMotion: boolean;
  onClose: () => void;
  onEditChild?: (child: Record<string, unknown>) => void;
  onAddMeasurement?: (child: Record<string, unknown>) => void;
  onOpenMeasurement?: (child: Record<string, unknown>) => void;
  onOpenPmt?: (child: Record<string, unknown>, category: string) => void;
  onRestoreChild?: (child: Record<string, unknown>) => void;
  onPermanentDelete?: (child: Record<string, unknown>) => void;
  onRequestDelete: (child: Record<string, unknown>) => void;
};

function MobileChildActionSheet({
  child,
  view,
  isReadOnly,
  reducedMotion,
  onClose,
  onEditChild,
  onAddMeasurement,
  onOpenMeasurement,
  onOpenPmt,
  onRestoreChild,
  onPermanentDelete,
  onRequestDelete,
}: MobileChildActionSheetProps) {
  const childName = String(value(child, "nama", "name"));
  const transition = reducedMotion
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 420, damping: 32, mass: 0.7 };
  const run = (callback?: (record: Record<string, unknown>) => void) => {
    onClose();
    callback?.(child);
  };
  const runPmt = () => {
    onClose();
    onOpenPmt?.(child, view);
  };
  return (
    <motion.div
      className="fixed inset-0 z-[70] md:hidden"
      initial={reducedMotion ? undefined : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={reducedMotion ? undefined : { opacity: 0 }}
      transition={{ duration: reducedMotion ? 0 : 0.16 }}
    >
      <button
        type="button"
        className="absolute inset-0 h-full w-full bg-slate-900/15 backdrop-blur-sm"
        aria-label="Tutup aksi balita"
        onClick={onClose}
      />
      <motion.section
        role="dialog"
        aria-modal="true"
        aria-labelledby="mobile-child-actions-title"
        className="mobile-child-action-sheet absolute inset-x-0 bottom-0 rounded-t-[32px] border border-white/30 bg-white/70 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl shadow-slate-900/20 backdrop-blur-2xl backdrop-saturate-150"
        initial={reducedMotion ? undefined : { y: "100%" }}
        animate={{ y: 0 }}
        exit={reducedMotion ? undefined : { y: "100%" }}
        transition={transition}
      >
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-slate-300/70" aria-hidden="true" />
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Aksi balita</p>
          <h2 id="mobile-child-actions-title" className="mt-1 truncate text-lg font-bold text-slate-800">{childName}</h2>
        </div>
        <div className="space-y-1" role="menu">
          {view !== "recycle" && !isReadOnly && onOpenPmt && ["problem_wasting", "problem_underweight", "problem_tidak_naik"].includes(view) ? (
            <button type="button" role="menuitem" className="mobile-child-action-item" onClick={runPmt}>
              <span className="mobile-child-action-icon mobile-child-action-icon--orange"><Gift className="h-4 w-4" /></span>
              <span><strong>Beri PMT</strong><small>Catat pemberian makanan tambahan</small></span>
            </button>
          ) : null}
          {view !== "recycle" && !isReadOnly && onEditChild ? (
            <button type="button" role="menuitem" className="mobile-child-action-item" onClick={() => run(onEditChild)}>
              <span className="mobile-child-action-icon mobile-child-action-icon--blue"><Pencil className="h-4 w-4" /></span>
              <span><strong>Edit Identitas</strong><small>Perbarui data dasar balita</small></span>
            </button>
          ) : null}
          {view !== "recycle" && !isReadOnly && onOpenMeasurement ? (
            <button type="button" role="menuitem" className="mobile-child-action-item" onClick={() => run(onOpenMeasurement)}>
              <span className="mobile-child-action-icon mobile-child-action-icon--green"><Ruler className="h-4 w-4" /></span>
              <span><strong>Pengukuran Balita</strong><small>Buka riwayat pengukuran</small></span>
            </button>
          ) : null}
          {view === "recycle" && !isReadOnly && onRestoreChild ? (
            <button type="button" role="menuitem" className="mobile-child-action-item" onClick={() => run(onRestoreChild)}>
              <span className="mobile-child-action-icon mobile-child-action-icon--green"><RotateCcw className="h-4 w-4" /></span>
              <span><strong>Pulihkan Data</strong><small>Kembalikan balita ke daftar aktif</small></span>
            </button>
          ) : null}
          {view !== "recycle" && !isReadOnly ? (
            <button
              type="button"
              role="menuitem"
              className="mobile-child-action-item mobile-child-action-item--danger mt-2 border-t border-white/30 pt-3"
              onClick={() => {
                onClose();
                onRequestDelete(child);
              }}
            >
              <span className="mobile-child-action-icon mobile-child-action-icon--red"><Trash2 className="h-4 w-4" /></span>
              <span><strong>Hapus Balita</strong><small>Data akan dipindahkan ke Recycle Bin</small></span>
            </button>
          ) : null}
          {view === "recycle" && !isReadOnly && onPermanentDelete ? (
            <button type="button" role="menuitem" className="mobile-child-action-item mobile-child-action-item--danger mt-2 border-t border-white/30 pt-3" onClick={() => run(onPermanentDelete)}>
              <span className="mobile-child-action-icon mobile-child-action-icon--red"><Trash2 className="h-4 w-4" /></span>
              <span><strong>Hapus Permanen</strong><small>Tindakan ini tidak dapat dibatalkan</small></span>
            </button>
          ) : null}
          {isReadOnly ? (
            <p className="px-2 py-3 text-center text-xs font-semibold text-slate-400">Hanya baca</p>
          ) : null}
        </div>
        <button type="button" className="mt-4 w-full rounded-full bg-white/45 px-4 py-2.5 text-sm font-semibold text-slate-600 ring-1 ring-white/30 transition hover:bg-white/75" onClick={onClose}>Batal</button>
      </motion.section>
    </motion.div>
  );
}

type MobileDeleteConfirmProps = {
  child: Record<string, unknown>;
  reducedMotion: boolean;
  onClose: () => void;
  onConfirm: (id: string) => Promise<void> | void;
};

function MobileDeleteConfirm({ child, reducedMotion, onClose, onConfirm }: MobileDeleteConfirmProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const childName = String(value(child, "nama", "name"));
  const submit = async () => {
    const id = String(child.id || "");
    if (!id) {
      setError("Data balita tidak ditemukan.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onConfirm(id);
      onClose();
    } catch (cause) {
      setError(errorMessage(cause, "Data balita gagal dihapus."));
    } finally {
      setSaving(false);
    }
  };
  return (
    <motion.div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/20 p-4 backdrop-blur-sm md:hidden"
      initial={reducedMotion ? undefined : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={reducedMotion ? undefined : { opacity: 0 }}
    >
      <motion.section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="mobile-delete-child-title"
        className="w-full max-w-sm rounded-[28px] border border-white/35 bg-white/75 p-5 shadow-2xl shadow-slate-900/20 backdrop-blur-2xl"
        initial={reducedMotion ? undefined : { scale: 0.96, y: 8 }}
        animate={{ scale: 1, y: 0 }}
      >
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-500/10 text-rose-600 ring-1 ring-rose-200/60"><Trash2 className="h-5 w-5" /></span>
          <div className="min-w-0">
            <h2 id="mobile-delete-child-title" className="text-base font-bold text-slate-800">Hapus data {childName}?</h2>
            <p className="mt-1 text-sm text-slate-500">Tindakan ini tidak bisa dibatalkan.</p>
          </div>
        </div>
        {error ? <p role="alert" className="mt-4 rounded-xl bg-rose-500/10 p-3 text-xs font-medium text-rose-700">{error}</p> : null}
        <div className="mt-5 flex gap-2.5">
          <button type="button" className="flex-1 rounded-full bg-white/40 px-4 py-2.5 text-sm font-semibold text-slate-600 ring-1 ring-slate-300/50 transition hover:bg-white/75" disabled={saving} onClick={onClose}>Batal</button>
          <button type="button" className="flex-1 rounded-full bg-gradient-to-b from-rose-500 to-rose-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-rose-500/25 transition hover:from-rose-600 hover:to-rose-700 disabled:cursor-not-allowed disabled:opacity-60" disabled={saving} onClick={() => void submit()}>{saving ? "Menghapus…" : "Hapus"}</button>
        </div>
      </motion.section>
    </motion.div>
  );
}

type ChildTableRowProps = {
  item: ChildrenPageResponse["items"][number];
  index: number;
  page: number;
  view: ChildView;
  asOf: string;
  measurement: Record<string, unknown>;
  showDesa: boolean;
  showPosyandu: boolean;
  isReadOnly: boolean;
  onOpenMeasurement?: (child: Record<string, unknown>) => void;
  onEditChild?: (child: Record<string, unknown>) => void;
  onOpenPmt?: (child: Record<string, unknown>, category: string) => void;
  onRestoreChild?: (child: Record<string, unknown>) => void;
  onPermanentDelete?: (child: Record<string, unknown>) => void;
  onDelete: (child: Record<string, unknown>) => void;
};

/**
 * A table row is intentionally isolated from the paginated page component.
 * The page can re-render when filters, dialogs, or realtime state change,
 * while rows whose source objects did not change are skipped by React.memo.
 */
const ChildTableRow = memo(function ChildTableRow({
  item,
  index,
  page,
  view,
  asOf,
  measurement,
  showDesa,
  showPosyandu,
  isReadOnly,
  onOpenMeasurement,
  onEditChild,
  onOpenPmt,
  onRestoreChild,
  onPermanentDelete,
  onDelete,
}: ChildTableRowProps) {
  const child = dataOf(item);
  const id = String(item.id || value(child, "id"));
  // Keep the document id with the flattened row data. The API returns ids
  // beside `data`, but every action needs the id to address the same child.
  const childRecord = { ...child, id };
  const storedAge = value(child, "ageInMonths", "usiaBulan");
  const storedAgeNumber = Number(storedAge);
  const measurementAge = value(measurement, "ageInMonths", "usiaBulan");
  const measurementAgeNumber = Number(measurementAge);
  // Age is a property of the child and report period, not of whether the
  // latest measurement has finished Python analysis. Prefer the deterministic
  // birth-date calculation so rows without a measurement still show an age.
  const birthDate = value(child, "tglLahir", "birthDate", "birth_date");
  const ageInMonths =
    getCompletedAgeInMonths(birthDate, asOf) ??
    (storedAge !== "-" && Number.isFinite(storedAgeNumber)
      ? Math.trunc(storedAgeNumber)
      : measurementAge !== "-" && Number.isFinite(measurementAgeNumber)
        ? Math.trunc(measurementAgeNumber)
        : null);
  const status = (key: string, ...aliases: string[]) =>
    value(measurement, key, ...aliases);
  const analysisLoading = false;
  const analysisBadge = (statusValue: string) => <StatusBadge status={statusValue} />;

  return (
    <tr className="ios-data-row text-xs">
      <td className="whitespace-nowrap border-r border-slate-100 px-4 py-3 text-center text-slate-500 md:sticky md:left-0 md:z-10 md:bg-white">
        {(page - 1) * PAGE_SIZE + index + 1}
      </td>
      <td className="min-w-[12rem] whitespace-normal border-r border-slate-100 px-4 py-3 md:sticky md:left-[48px] md:z-10 md:bg-white md:shadow-lg">
        <p className="break-words font-bold text-slate-900">
          {value(child, "nama", "name")}
        </p>
        <p
          className={`break-all font-mono text-[10px] ${
            childHasManualNik(child)
              ? "text-slate-500"
              : "font-bold text-red-600"
          }`}
        >
          {value(child, "nik", "national_id")}
        </p>
        <div className="mt-1 flex items-center gap-1">
          <Badge color={value(child, "jk", "gender") === "L" ? "blue" : "pink"}>
            {value(child, "jk", "gender") === "L" ? "L" : "P"}
          </Badge>
          <span className="text-[10px] text-slate-400">
            {formatIndoDate(String(birthDate))}{" "}
            ({ageInMonths === null ? "-" : ageInMonths} Bln)
          </span>
        </div>
      </td>
      <td className="whitespace-nowrap border-r border-slate-100 px-4 py-3 text-slate-700">
        {value(child, "namaOrtu", "parentName")}
      </td>
      {view === "recycle" ? (
        <td className="min-w-[11rem] border-r border-slate-100 bg-rose-50/30 px-4 py-3 font-semibold text-rose-700">
          {value(child, "deleteReason", "alasanDihapus")}
        </td>
      ) : null}
      {showDesa ? (
        <td className="whitespace-nowrap border-r border-slate-100 px-4 py-3 text-slate-600">
          {value(child, "desa", "village")}
        </td>
      ) : null}
      {showPosyandu ? (
        <td className="whitespace-nowrap border-r border-slate-100 px-4 py-3 text-slate-600">
          {value(child, "posyandu")}
        </td>
      ) : null}
      <td className="border-r border-slate-100 bg-blue-50/10 px-2 py-3 text-center font-mono">
        {value(measurement, "bb", "weight")}
      </td>
      <td className="border-r border-slate-100 bg-blue-50/10 px-2 py-3 text-center font-mono">
        {value(measurement, "tb", "pb", "height")}
      </td>
      <td className="border-r border-slate-100 bg-blue-50/10 px-2 py-3 text-center font-mono">
        {value(measurement, "lila", "muac")}
      </td>
      <td className="border-r border-slate-100 bg-blue-50/10 px-2 py-3 text-center font-mono">
        {value(measurement, "lk", "headCircumference")}
      </td>
      <td className="border-r border-slate-100 bg-indigo-50/10 px-2 py-3 text-center">
        {analysisLoading ? (
          <SkeletonBlock className="table-analysis-skeleton table-analysis-skeleton-badge" />
        ) : (
          <KenaikanBadge
            status={String(status("weightGainStatus", "statusNaik"))}
          />
        )}
      </td>
      <td className="border-r border-slate-100 bg-emerald-50/10 px-2 py-3 text-center">
        {analysisBadge(String(status("bbuStatus", "statusBbu")))}
      </td>
      <td className="border-r border-slate-100 bg-emerald-50/10 px-2 py-3 text-center">
        {analysisBadge(String(status("tbuStatus", "statusTbu")))}
      </td>
      <td className="border-r border-slate-100 bg-emerald-50/10 px-2 py-3 text-center">
        {analysisBadge(String(status("bbtbStatus", "statusBbtb")))}
      </td>
      <td className="border-r border-slate-100 bg-emerald-50/10 px-2 py-3 text-center">
        {analysisBadge(String(status("imtuStatus", "statusImtu")))}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-center">
        <div className="flex justify-center gap-1">
          {isReadOnly ? (
            <span className="text-xs font-semibold text-slate-400">Hanya baca</span>
          ) : view === "recycle" ? (
            <>
              <button
                type="button"
                className="apple-button table-action-button table-action-green"
                title="Pulihkan"
                aria-label="Pulihkan balita"
                onClick={() => onRestoreChild?.(childRecord)}
              >
                <RotateCcw className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="apple-button table-action-button table-action-red"
                title="Hapus Permanen"
                aria-label="Hapus permanen"
                onClick={() => onPermanentDelete?.(childRecord)}
              >
                <X className="h-4 w-4" />
              </button>
            </>
          ) : (
            <>
              {onOpenPmt &&
              ["problem_wasting", "problem_underweight", "problem_tidak_naik"].includes(
                view,
              ) ? (
                <button
                  type="button"
                  onClick={() => onOpenPmt(childRecord, view)}
                  className="apple-button table-action-button table-action-pmt"
                  title="Beri PMT"
                  aria-label="Beri PMT"
                >
                  <Gift className="h-4 w-4" />
                </button>
              ) : null}
              {onEditChild ? (
                <button
                  type="button"
                  onClick={() => onEditChild(childRecord)}
                  className="apple-button table-action-button table-action-blue"
                  title="Edit Identitas"
                  aria-label="Edit Identitas"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              ) : null}
              {onOpenMeasurement ? (
                <button
                  type="button"
                  onClick={() => onOpenMeasurement(childRecord)}
                  className="apple-button table-action-button table-action-cyan"
                  title="Pengukuran Balita"
                  aria-label="Pengukuran Balita"
                >
                  <Ruler className="h-4 w-4" />
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => onDelete(childRecord)}
                className="apple-button table-action-button table-action-red"
                title="Hapus Balita"
                aria-label="Hapus Balita"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
});

export type ReactChildrenTablePageProps = {
  user: DashboardUser;
  scope: Scope;
  onOpenMeasurement?: (child: Record<string, unknown>) => void;
  onAddMeasurement?: (child: Record<string, unknown>) => void;
  /**
   * When the table is opened from a dedicated sidebar item, start on that
   * server-side view instead of making the user select it a second time.
   */
  initialView?: ChildView;
  onOpenAddChild?: () => void;
  onEditChild?: (child: Record<string, unknown>) => void;
  onOpenPmt?: (child: Record<string, unknown>, category: string) => void;
  onRestoreChild?: (child: Record<string, unknown>) => void;
  onPermanentDelete?: (child: Record<string, unknown>) => void;
  onExportTable?: () => void;
  onExportMeasurement?: () => void;
  onExportSigizi?: () => void;
  onImportIdentitas?: () => void;
};

/**
 * Server-paged React child table. Reads use the Rust/Redis/PostgreSQL result
 * path; mutations are handled by the strict React add/measurement workflows.
 */
export default function ReactChildrenTablePage({
  user,
  scope,
  onOpenMeasurement,
  onAddMeasurement,
  initialView = "data",
  onOpenAddChild,
  onEditChild,
  onOpenPmt,
  onRestoreChild,
  onPermanentDelete,
  onExportTable,
  onExportMeasurement,
  onExportSigizi,
  onImportIdentitas,
}: ReactChildrenTablePageProps) {
  const [page, setPage] = useState(1);
  const [view, setView] = useState<ChildView>(initialView);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("recent");
  const [nikStatus, setNikStatus] = useState<NikStatus>("all");
  const tableViewportRef = useRef<HTMLDivElement>(null);
  const debouncedSearch = useDebouncedValue(search);
  const request = useMemo(
    () => toRequest(scope, user, page, debouncedSearch, sort, nikStatus, view),
    [debouncedSearch, nikStatus, page, sort, scope, user, view],
  );
  const queryClient = useQueryClient();
  const pageQuery = useQuery({
    queryKey: ["children-page", request],
    queryFn: () => getChildrenPage(request),
    // Do not render a previous page while a new filter/page is loading.  The
    // server response for this exact request is authoritative; showing old
    // rows would make totals appear inconsistent with the dashboard.
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
  const [childToDelete, setChildToDelete] = useState<Record<
    string,
    any
  > | null>(null);
  const reducedMotion = useReducedMotion();
  const isMobileViewport = useIsMobileViewport();
  const [mobileActionChild, setMobileActionChild] = useState<Record<string, unknown> | null>(null);
  const [mobileDeleteChild, setMobileDeleteChild] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    setPage(1);
  }, [
    scope.ageGroup,
    scope.month,
    scope.year,
    scope.desa,
    scope.posyandu,
    view,
    debouncedSearch,
  ]);

  useEffect(() => {
    setView(initialView);
    setPage(1);
  }, [initialView]);

  const state: PageState<ChildrenPageResponse> = pageQuery.data
    ? { status: "success", data: pageQuery.data }
    : pageQuery.error
      ? {
          status: "error",
          message: errorMessage(
            pageQuery.error,
            "Data balita belum dapat dimuat.",
          ),
        }
      : { status: "loading" };
  const response = state.status === "success" ? state.data : null;
  const items = response?.items || [];
  const measurements = useMemo(
    () => (response ? measurementMap(response) : EMPTY_MEASUREMENT_MAP),
    [response],
  );
  const total = response?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const isReadOnly = user.accessMode === "read";
  const showDesa = isFullAccessRole(user.role);
  const showPosyandu = user.role === ROLES.BIDAN || isFullAccessRole(user.role);
  const tableColumnCount =
    13 +
    (view === "recycle" ? 1 : 0) +
    (showDesa ? 1 : 0) +
    (showPosyandu ? 1 : 0);

  const clearSearch = () => {
    setSearch("");
    setPage(1);
  };
  const handleDeleteRequest = useCallback(
    (child: Record<string, unknown>) => setChildToDelete(child),
    [],
  );

  const confirmDelete = async (id: string, payload: Record<string, string>) => {
    await updateDoc(
      doc(db, "artifacts", appId, "public", "data", "children", id),
      {
        ...payload,
        deletedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { deferSync: true },
    );
    await syncPendingMutations();
    setChildToDelete(null);
    await queryClient.invalidateQueries({ queryKey: ["children-page"] });
  };

  const title = pageHeading(view, scope.month, scope.year);
  return (
    <div className="apple-page space-y-6" data-react-children-page="true">
      {childToDelete ? (
        <DeleteChildModal
          child={childToDelete}
          onClose={() => setChildToDelete(null)}
          onConfirm={confirmDelete}
        />
      ) : null}
      <AnimatePresence>
        {mobileActionChild ? (
          <MobileChildActionSheet
            child={mobileActionChild}
            view={view}
            isReadOnly={isReadOnly}
            reducedMotion={Boolean(reducedMotion)}
            onClose={() => setMobileActionChild(null)}
            onEditChild={onEditChild}
            onAddMeasurement={onAddMeasurement}
            onOpenMeasurement={onOpenMeasurement}
            onOpenPmt={onOpenPmt}
            onRestoreChild={onRestoreChild}
            onPermanentDelete={onPermanentDelete}
            onRequestDelete={(child) => setMobileDeleteChild(child)}
          />
        ) : null}
        {mobileDeleteChild ? (
          <MobileDeleteConfirm
            child={mobileDeleteChild}
            reducedMotion={Boolean(reducedMotion)}
            onClose={() => setMobileDeleteChild(null)}
            onConfirm={(id) => confirmDelete(id, { deleteReason: "Salah Input" })}
          />
        ) : null}
      </AnimatePresence>
      <section className="children-table-panel relative overflow-hidden rounded-[28px] border border-white/25 bg-white/40 p-4 shadow-[0_18px_48px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.65)] ring-1 ring-white/25 backdrop-blur-2xl backdrop-saturate-150 sm:p-5">
        <div className="children-table-panel-highlight" aria-hidden="true" />
        <div className="relative z-10 space-y-4">
          <div className="children-table-summary flex flex-col gap-3 rounded-[22px] bg-white/20 px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:px-4">
            <div className="min-w-0">
              <h2 className="apple-page-title">{title}</h2>
              <p className="text-sm text-slate-500">
                {view === "mpasi" ? (
                  <>
                    Menampilkan <span className="children-table-count-pill">{total}</span>{" "}
                    balita usia 6-23 bulan untuk pemantauan MPASI.
                  </>
                ) : (
                  <>
                    Menampilkan <span className="children-table-count-pill">{total}</span>{" "}
                    data balita · {MONTHS[scope.month - 1]} {scope.year}
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="children-table-toolbar flex flex-col gap-3 rounded-[22px] border border-white/20 bg-white/20 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] lg:flex-row lg:items-center">
          <div className="flex w-full sm:w-72">
            <label className="sr-only" htmlFor="react-child-search">
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
                id="react-child-search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Cari Nama / NIK..."
                className="children-table-search-input min-h-11 w-full rounded-full border border-white/20 bg-white/50 py-2.5 pl-11 pr-8 text-sm text-slate-700 outline-none shadow-sm placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
              {search.trim() ? (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 transition hover:bg-white/60 hover:text-slate-700"
                  aria-label="Hapus pencarian"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          </div>
          <div className="children-table-select-wrap relative w-full sm:w-52">
            <label className="sr-only" htmlFor="react-child-sort">
              Urutkan data
            </label>
            <select
              id="react-child-sort"
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
              <Filter className="h-4 w-4" />
            </span>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </div>
          <div className="children-table-select-wrap relative w-full sm:w-52">
            <label className="sr-only" htmlFor="react-child-nik-status">
              Filter NIK
            </label>
            <select
              id="react-child-nik-status"
              value={nikStatus}
              onChange={(event) => {
                const next = event.target.value as NikStatus;
                setNikStatus(next);
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
            {view !== "recycle" ? (
              <AppButton
                type="button"
                variant="ghost"
                className="children-table-action children-table-export-action children-table-export-action--table ios-toolbar-button icon-only-mobile whitespace-nowrap"
                title="Export tabel balita"
                onClick={onExportTable}
              >
                <span className="ios-button-symbol" aria-hidden="true">
                  <FileText className="h-4 w-4" />
                </span>
                <span className="hidden sm:inline">Export Tabel</span>
              </AppButton>
            ) : null}
            {view !== "recycle" && view !== "recent" ? (
              <AppButton
                type="button"
                variant="ghost"
                className="children-table-action children-table-export-action children-table-export-action--measurement ios-toolbar-button icon-only-mobile whitespace-nowrap"
                title="Export pengukuran"
                onClick={onExportMeasurement}
              >
                <span className="ios-button-symbol" aria-hidden="true">
                  <FileDown className="h-4 w-4" />
                </span>
                <span className="hidden sm:inline">Export Pengukuran</span>
              </AppButton>
            ) : null}
            {view === "recent" ? (
              <>
                {!isReadOnly ? (
                  <AppButton
                    type="button"
                    variant="ghost"
                    className="children-table-action children-table-export-action children-table-export-action--import ios-toolbar-button icon-only-mobile whitespace-nowrap"
                    title="Import identitas"
                    onClick={onImportIdentitas}
                  >
                    <span className="ios-button-symbol" aria-hidden="true">
                      <FileUp className="h-4 w-4" />
                    </span>
                    <span className="hidden sm:inline">Import</span>
                  </AppButton>
                ) : null}
                <AppButton
                  type="button"
                  variant="ghost"
                  className="children-table-action children-table-export-action children-table-export-action--sigizi ios-toolbar-button icon-only-mobile whitespace-nowrap"
                  title="Export identitas Sigizi"
                  onClick={onExportSigizi}
                >
                  <span className="ios-button-symbol" aria-hidden="true">
                    <FileDown className="h-4 w-4" />
                  </span>
                  <span className="hidden sm:inline">Export Sigizi</span>
                </AppButton>
              </>
            ) : null}
            {onOpenAddChild &&
            view !== "recycle" &&
            !isReadOnly ? (
              <AppButton
                type="button"
                onClick={onOpenAddChild}
                variant="primary"
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
          Gagal memuat data balita: {state.message}
        </div>
      ) : null}
      {isMobileViewport ? (
        <div className="mobile-children-list space-y-3 md:hidden" aria-label="Daftar balita">
          {state.status === "loading" ? (
            Array.from({ length: 4 }, (_, index) => <MobileChildCardSkeleton key={index} />)
          ) : items.length === 0 ? (
            <div className="rounded-2xl bg-white/40 p-6 text-center text-sm text-slate-400 ring-1 ring-white/25">
              Tidak ada data ditemukan
            </div>
          ) : (
            items.map((item, index) => {
              const id = String(item.id || value(dataOf(item), "id"));
              return (
                <MobileChildCard
                  key={id || index}
                  item={item}
                  index={index}
                  page={page}
                  view={view}
                  asOf={request.asOf}
                  measurement={measurements.get(id) || EMPTY_MEASUREMENT}
                  isReadOnly={isReadOnly}
                  onOpenMeasurement={onOpenMeasurement}
                  onEditChild={onEditChild}
                  onOpenPmt={onOpenPmt}
                  onRestoreChild={onRestoreChild}
                  onPermanentDelete={onPermanentDelete}
                  onDeleteRequest={(child) => setMobileDeleteChild(child)}
                />
              );
            })
          )}
        </div>
      ) : null}
      {!isMobileViewport ? (
      <div className="hidden md:block">
          <Card className="ios-table-card children-table-card overflow-hidden">
              <DataTable
                ref={tableViewportRef}
                className="children-table-scroll"
                ariaLabel="Daftar balita React"
              >
          <table className="ios-data-table ios-children-table min-w-full">
            <thead className="children-table-head sticky top-0 z-20 bg-white/60 backdrop-blur-md">
              <tr>
                <th className="border-r border-slate-200 px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500 md:sticky md:left-0 md:z-20 md:bg-slate-50">
                  No
                </th>
                <th className="border-r border-slate-200 px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500 md:sticky md:left-[48px] md:z-20 md:bg-slate-50 md:shadow-lg">
                  Identitas
                </th>
                <th className="border-r border-slate-200 px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Ortu
                </th>
                {view === "recycle" ? (
                  <th className="border-r border-slate-200 bg-rose-50/60 px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-rose-600">
                    Alasan Dihapus
                  </th>
                ) : null}
                {showDesa ? (
                  <th className="border-r border-slate-200 px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Desa
                  </th>
                ) : null}
                {showPosyandu ? (
                  <th className="border-r border-slate-200 px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Posyandu
                  </th>
                ) : null}
                <th className="border-r border-slate-200 bg-blue-50/50 px-4 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  BB
                  <br />
                  (kg)
                </th>
                <th className="border-r border-slate-200 bg-blue-50/50 px-4 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  PB/TB
                  <br />
                  (cm)
                </th>
                <th className="border-r border-slate-200 bg-blue-50/50 px-4 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  LILA
                  <br />
                  (cm)
                </th>
                <th className="border-r border-slate-200 bg-blue-50/50 px-4 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  LK
                  <br />
                  (cm)
                </th>
                <th className="border-r border-slate-200 bg-indigo-50/50 px-4 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Status
                  <br />
                  Kenaikan
                </th>
                <th className="border-r border-slate-200 bg-emerald-50/50 px-4 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Status
                  <br />
                  BB/U
                </th>
                <th className="border-r border-slate-200 bg-emerald-50/50 px-4 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Status
                  <br />
                  PB/TB-U
                </th>
                <th className="border-r border-slate-200 bg-emerald-50/50 px-4 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Status
                  <br />
                  BB/PB atau BB/TB
                </th>
                <th className="border-r border-slate-200 bg-emerald-50/50 px-4 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Status
                  <br />
                  IMT/U
                </th>
                <th className="px-4 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="children-table-body divide-y divide-white/20 bg-white/20">
              {state.status === "loading" ? (
                <TableSkeleton columns={tableColumnCount} />
              ) : items.length === 0 ? (
                <tr>
                  <td
                    colSpan={tableColumnCount}
                    className="px-6 py-12 text-center text-slate-400"
                  >
                    Tidak ada data ditemukan
                  </td>
                </tr>
              ) : (
                items.map((item, index) => {
                  const id = String(item.id || value(dataOf(item), "id"));
                  return (
                    <ChildTableRow
                      key={id || index}
                      item={item}
                      index={index}
                      page={page}
                      view={view}
                      asOf={request.asOf}
                      measurement={measurements.get(id) || EMPTY_MEASUREMENT}
                      showDesa={showDesa}
                      showPosyandu={showPosyandu}
                      isReadOnly={isReadOnly}
                      onOpenMeasurement={onOpenMeasurement}
                      onEditChild={onEditChild}
                      onOpenPmt={onOpenPmt}
                      onRestoreChild={onRestoreChild}
                      onPermanentDelete={onPermanentDelete}
                      onDelete={handleDeleteRequest}
                    />
                  );
                })
              )}
            </tbody>
          </table>
        </DataTable>
        <HorizontalTableScrollbar
          viewportRef={tableViewportRef}
          refreshKey={`${state.status}-${items.length}-${tableColumnCount}-${view}`}
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
      <div className="ios-table-footer flex flex-col items-center justify-between gap-4 sm:flex-row md:hidden">
        <span className="text-xs font-medium text-slate-500">
          Menampilkan {total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1} -{" "}
          {Math.min(page * PAGE_SIZE, total)} dari {total} data
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
    </div>
  );
}
