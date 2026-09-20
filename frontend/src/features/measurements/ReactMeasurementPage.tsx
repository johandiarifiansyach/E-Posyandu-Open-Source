// SPDX-License-Identifier: GPL-3.0-or-later


import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  syncMeasurementMutationsNow,
  updateDoc,
} from "../../api/syncApi";
import { fetchChildMeasurementHistory } from "../../services/measurementService";
import {
  MEASUREMENT_DECIMAL_RULES,
  normalizeMeasurementInput,
  parseMeasurementDecimalForRange,
  measurementMethodForAge,
  validateMeasurementForm,
} from "./measurementRules";
import { appId, db } from "../../app/session";
import {
  formatDate,
  formatIndoDate,
  getAgeInMonths,
} from "../../shared/formatters";
import {
  AppButton,
  Card,
  GlassInput,
  InputGroup,
  AppSelect,
  GrowthChartSkeleton,
  KenaikanBadge,
  SkeletonBlock,
} from "../../components/base";
import {
  CheckCircle2,
  ChevronLeft,
  History,
  AlertCircle,
  Loader2,
  Pencil,
  Plus,
  Scale,
  Trash2,
  TrendingUp,
} from "../../ui/icons";
import type { DashboardUser } from "../../types";

const ReactGrowthChartsPage = lazy(
  () => import("../growth-charts/ReactGrowthChartsPage"),
);

type Child = Record<string, any>;
type Measurement = Record<string, any> & { id: string };
type Form = {
  tglUkur: string;
  bb: string;
  tb: string;
  lila: string;
  lk: string;
  edema: string;
  kelasIbu: string;
  mbg: string;
  vitA: string;
  asi: string;
  caraUkur: string;
  statusNaik: string;
};
const inputClass =
  "w-full rounded-2xl border border-white/30 bg-white/60 p-3 text-sm text-slate-900 shadow-sm ring-1 ring-white/20 transition duration-200 focus:border-blue-400 focus:bg-white/80 focus:ring-2 focus:ring-blue-400/50";
const simpleOptions = (values: string[]) =>
  values.map((value) => ({ value, label: value }));
const emptyForm = (): Form => ({
  tglUkur: formatDate(new Date()),
  bb: "",
  tb: "",
  lila: "",
  lk: "",
  edema: "Tidak",
  kelasIbu: "Tidak",
  mbg: "Tidak",
  vitA: "Tidak",
  asi: "Tidak",
  // Set a visible default immediately; the effect below recalculates this
  // when the measurement date changes.
  caraUkur: "Terlentang",
  statusNaik: "B",
});

function normalise(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

function measurementMonthLabel(value: unknown) {
  const date = new Date(String(value || ""));
  if (Number.isNaN(date.getTime())) return "-";
  return date
    .toLocaleDateString("id-ID", { month: "short", year: "numeric" })
    .toLocaleUpperCase("id-ID");
}

function currentChildMeasurement(history: Measurement[], child: Child) {
  return (
    history[0] || {
      bb: child.currentBB ?? child.bbLahir,
      tb: child.currentTB ?? child.pbLahir,
      lila: child.currentLILA,
      lk: child.currentLK ?? child.lkLahir,
    }
  );
}

export type ReactMeasurementPageProps = {
  user?: DashboardUser;
  child: Child;
  initialMenu?: "history" | "add";
  onBack: () => void;
};

/** Measurement history and data-entry workflow without derived ML results. */
export default function ReactMeasurementPage({
  child,
  initialMenu = "history",
  onBack,
}: ReactMeasurementPageProps) {
  const reducedMotion = useReducedMotion();
  const segmentTransition = reducedMotion
    ? { duration: 0 }
    : {
        type: "spring" as const,
        stiffness: 420,
        damping: 28,
        mass: 0.55,
      };
  const [history, setHistory] = useState<Measurement[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [menu, setMenu] = useState<"history" | "add">(initialMenu);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(emptyForm);
  const [asiTouched, setAsiTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showCharts, setShowCharts] = useState(false);

  const ageAtMeasure = useMemo(
    () =>
      getAgeInMonths(
        child.tglLahir,
        new Date(`${form.tglUkur.slice(0, 10)}T00:00:00`),
      ),
    [child.tglLahir, form.tglUkur],
  );
  const showLila = ageAtMeasure >= 3;
  const showAsi = ageAtMeasure >= 0 && ageAtMeasure <= 6;
  const showVitA =
    new Date(`${form.tglUkur}T00:00:00`).getMonth() + 1 === 2 ||
    new Date(`${form.tglUkur}T00:00:00`).getMonth() + 1 === 8;
  const asiLabel = `ASI EKSKLUSIF USIA ${Math.max(0, Math.min(6, ageAtMeasure))} BULAN`;
  const monthlyHistory = useMemo(() => {
    const map = new Map<string, Measurement>();
    history.forEach((item) => {
      const key = String(item.tglUkur || "").slice(0, 7);
      if (
        key &&
        (!map.has(key) || String(item.tglUkur) > String(map.get(key)?.tglUkur))
      )
        map.set(key, item);
    });
    return [...map.values()].sort((a, b) =>
      String(b.tglUkur).localeCompare(String(a.tglUkur)),
    );
  }, [history]);

  useEffect(() => {
    let active = true;
    setLoadingHistory(true);
    setHistoryError(null);
    void fetchChildMeasurementHistory(child)
      .then((items) => {
        if (active) {
          setHistory((items || []) as Measurement[]);
          setLoadingHistory(false);
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setHistoryError(
            cause instanceof Error
              ? cause.message
              : "Riwayat penimbangan tidak dapat dimuat.",
          );
          setLoadingHistory(false);
        }
      });
    return () => {
      active = false;
    };
  }, [child]);

  useEffect(() => {
    setForm((current) => ({
      ...current,
      caraUkur: measurementMethodForAge(ageAtMeasure),
      lila: ageAtMeasure < 3 ? "" : current.lila,
      asi: !asiTouched && ageAtMeasure === 0 ? "Ya" : current.asi,
    }));
  }, [ageAtMeasure, asiTouched]);

  const startAdd = () => {
    setEditingId(null);
    setAsiTouched(false);
    const addDate = formatDate(new Date());
    const addAge = getAgeInMonths(
      child.tglLahir,
      new Date(`${addDate}T00:00:00`),
    );
    setForm({
      ...emptyForm(),
      tglUkur: addDate,
      caraUkur: measurementMethodForAge(addAge),
    });
    setMenu("add");
  };
  useEffect(() => {
    if (initialMenu === "add") {
      startAdd();
    } else {
      setMenu("history");
    }
  }, [child.id, initialMenu]);
  const startEdit = (measurement: Measurement) => {
    setEditingId(measurement.id);
    setAsiTouched(Boolean(measurement.asi));
    setForm({
      tglUkur: normalise(measurement.tglUkur).slice(0, 10),
      bb: normalise(measurement.bb),
      tb: normalise(measurement.tb),
      lila: normalise(measurement.lila),
      lk: normalise(measurement.lk),
      edema: normalise(measurement.edema || "Tidak"),
      kelasIbu: normalise(measurement.kelasIbu || "Tidak"),
      mbg: normalise(measurement.mbg || "Tidak"),
      vitA: normalise(measurement.vitA || "Tidak"),
      asi: normalise(measurement.asi || "Tidak"),
      caraUkur: measurementMethodForAge(
        getAgeInMonths(
          child.tglLahir,
          new Date(`${normalise(measurement.tglUkur).slice(0, 10)}T00:00:00`),
        ),
      ),
      statusNaik: normalise(measurement.statusNaik || "B"),
    });
    setMenu("add");
  };
  const decimalChange = (field: keyof Form, value: string) =>
    setForm((current) => ({
      ...current,
      [field]: normalizeMeasurementInput(value),
    }));
  const decimalBlur = (field: keyof typeof MEASUREMENT_DECIMAL_RULES) => {
    const value = form[field];
    const rule = MEASUREMENT_DECIMAL_RULES[field];
    const parsed = parseMeasurementDecimalForRange(
      value,
      rule.minimum,
      rule.maximum,
      rule.shift,
    );
    if (Number.isFinite(parsed))
      setForm((current) => ({
        ...current,
        [field]: String(parsed)
          .replace(/\.0+$/, "")
          .replace(/(\.\d*?)0+$/, "$1"),
      }));
  };

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validation = (validateMeasurementForm as any)({
      date: form.tglUkur,
      bb: form.bb,
      tb: form.tb,
      lila: form.lila,
      lk: form.lk,
      ageInMonths: ageAtMeasure,
    }) as {
      ok: boolean;
      message?: string;
      data?: {
        measurementDate: string;
        bb: number;
        tb: number;
        lila: number | null;
        lk: number;
      };
    };
    if (!validation.ok || !validation.data) {
      setHistoryError(validation.message || "Data pengukuran belum valid.");
      return;
    }
    setSaving(true);
    setHistoryError(null);
    const values = validation.data;
    const measurementAge = getAgeInMonths(
      child.tglLahir,
      new Date(`${values.measurementDate}T00:00:00`),
    );
    const payload = {
      childId: child.id,
      childName: child.nama,
      posyandu: child.posyandu,
      desa: child.desa,
      ...form,
      // Derive this at submit time as well, so a fast save immediately after
      // changing the date cannot persist a stale method from the prior age.
      caraUkur: measurementMethodForAge(measurementAge),
      tglUkur: values.measurementDate,
      bb: values.bb,
      tb: values.tb,
      lila: values.lila,
      lk: values.lk,
      ageInMonths: measurementAge,
      updatedAt: serverTimestamp(),
    };
    try {
      const mutation = editingId
        ? await updateDoc(
            doc(
              db,
              "artifacts",
              appId,
              "public",
              "data",
              "measurements",
              editingId,
            ),
            payload,
            { deferSync: true },
          )
        : await addDoc(
            collection(
              db,
              "artifacts",
              appId,
              "public",
              "data",
              "measurements",
            ),
            { ...payload, createdAt: serverTimestamp() },
            { deferSync: true },
          );
      const id =
        editingId ||
        ("id" in mutation && typeof mutation.id === "string"
          ? mutation.id
          : "");
      const projected = [
        ...history.filter((item) => item.id !== id),
        { ...payload, id } as Measurement,
      ].sort((a, b) => String(b.tglUkur).localeCompare(String(a.tglUkur)));
      const latest = currentChildMeasurement(projected, child);
      const childMutation = await updateDoc(
        doc(db, "artifacts", appId, "public", "data", "children", child.id),
        {
          currentBB: latest.bb ?? child.bbLahir ?? null,
          currentTB: latest.tb ?? child.pbLahir ?? null,
          currentLILA: latest.lila ?? null,
          currentLK: latest.lk ?? child.lkLahir ?? null,
          lastMeasurementDate: latest.tglUkur ?? null,
          updatedAt: serverTimestamp(),
        },
        { deferSync: true },
      );
      await syncMeasurementMutationsNow([
        mutation.mutationId,
        childMutation.mutationId,
      ]);
      setHistory(projected);
      setMenu("history");
    } catch (cause) {
      setHistoryError(
        cause instanceof Error
          ? cause.message
          : "Data penimbangan belum dapat disimpan.",
      );
    } finally {
      setSaving(false);
    }
  };

  const remove = async (measurement: Measurement) => {
    if (
      !window.confirm(
        `Hapus penimbangan tanggal ${formatIndoDate(measurement.tglUkur)}?`,
      )
    )
      return;
    setDeletingId(measurement.id);
    try {
      await deleteDoc(
        doc(
          db,
          "artifacts",
          appId,
          "public",
          "data",
          "measurements",
          measurement.id,
        ),
      );
      const remaining = history.filter((item) => item.id !== measurement.id);
      const latest = currentChildMeasurement(remaining, child);
      await updateDoc(
        doc(db, "artifacts", appId, "public", "data", "children", child.id),
        {
          currentBB: latest.bb ?? child.bbLahir ?? null,
          currentTB: latest.tb ?? child.pbLahir ?? null,
          currentLILA: latest.lila ?? null,
          currentLK: latest.lk ?? child.lkLahir ?? null,
          lastMeasurementDate: latest.tglUkur ?? null,
          updatedAt: serverTimestamp(),
        },
      );
      setHistory(remaining);
    } catch (cause) {
      setHistoryError(
        cause instanceof Error ? cause.message : "Riwayat tidak dapat dihapus.",
      );
    } finally {
      setDeletingId(null);
    }
  };
  const field = (key: keyof Form, label: string, required = true) => (
    <InputGroup label={label}>
      <GlassInput
        required={required}
        name={key}
        type={key === "tglUkur" ? "date" : "text"}
        inputMode={key === "tglUkur" ? undefined : "decimal"}
        className={inputClass}
        value={form[key]}
        onChange={(event) =>
          key === "bb" || key === "tb" || key === "lila" || key === "lk"
            ? decimalChange(key, event.target.value)
            : setForm((current) => ({ ...current, [key]: event.target.value }))
        }
        onBlur={() =>
          key === "bb" || key === "tb" || key === "lila" || key === "lk"
            ? decimalBlur(key)
            : undefined
        }
      />
    </InputGroup>
  );
  const select = (
    key: keyof Form,
    label: string,
    options: Array<{ value: string; label: string }>,
  ) => (
    <InputGroup label={label}>
      <AppSelect
        value={form[key]}
        options={options}
        className="measurement-select-field"
        onChange={(event) =>
          setForm((current) => ({ ...current, [key]: event.target.value }))
        }
      />
    </InputGroup>
  );

  const tableHeaders = [
    "Bulan",
    "Tanggal Ukur",
    "BB",
    "PB/TB",
    "LILA",
    "LK",
    "Naik BB",
    "Aksi",
  ];
  const actionButton = (
    kind: "edit" | "delete",
    item: Measurement,
    extraClass = "",
  ) => (
    <button
      type="button"
      className={`table-action-button table-action-${kind === "edit" ? "blue" : "red"} ${extraClass}`.trim()}
      aria-label={`${kind === "edit" ? "Edit" : "Hapus"} penimbangan tanggal ${formatIndoDate(item.tglUkur)}`}
      disabled={Boolean(deletingId)}
      onClick={() => (kind === "edit" ? startEdit(item) : void remove(item))}
    >
      {kind === "delete" && deletingId === item.id ? (
        <Loader2 className="h-4 w-4" />
      ) : kind === "edit" ? (
        <Pencil className="h-4 w-4" />
      ) : (
        <Trash2 className="h-4 w-4" />
      )}
    </button>
  );

  const mobileMeasurementCard = (item: Measurement) => {
    const displayValue = (value: unknown) => {
      const text = normalise(value);
      return text || "-";
    };
    const metric = (label: string, value: unknown, unit: string) => (
      <div className="measurement-mobile-metric" key={label}>
        <span>{label}</span>
        <strong>{displayValue(value)}</strong>
        <small>{unit}</small>
      </div>
    );
    return (
      <article className="measurement-mobile-card" key={item.id}>
        <div className="measurement-mobile-card-heading">
          <div className="measurement-mobile-card-date">
            <strong>{measurementMonthLabel(item.tglUkur)}</strong>
            <span>{formatIndoDate(item.tglUkur)}</span>
          </div>
          <div className="measurement-mobile-card-actions">
            {actionButton("edit", item, "measurement-mobile-action-button")}
            {actionButton("delete", item, "measurement-mobile-action-button")}
          </div>
        </div>

        <div className="measurement-mobile-metric-grid" aria-label="Antropometri">
          {metric("BB", item.bb, "kg")}
          {metric("TB/PB", item.tb, "cm")}
          {metric("LILA", item.lila, "cm")}
          {metric("LK", item.lk, "cm")}
        </div>

        <div className="measurement-mobile-status-row" aria-label="Status kenaikan berat badan">
          <span className="measurement-mobile-status-chip">
            <span>Naik BB</span>
            <KenaikanBadge status={String(item.statusNaik || "-")} />
          </span>
        </div>
      </article>
    );
  };
  return (
    <div
      className="measurement-page apple-page space-y-6"
      data-react-measurement-page="true"
    >
      {showCharts ? (
        <Suspense
          fallback={
            <div className="growth-chart-backdrop" role="presentation">
              <GrowthChartSkeleton />
            </div>
          }
        >
          <ReactGrowthChartsPage
            child={child}
            history={monthlyHistory}
            onClose={() => setShowCharts(false)}
          />
        </Suspense>
      ) : null}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <AppButton
            type="button"
            variant="secondary"
            className="ios-back-button mb-4"
            onClick={onBack}
            title="Kembali ke daftar balita"
          >
            <ChevronLeft className="h-4 w-4" /> Kembali
          </AppButton>
          <div className="flex items-center gap-3">
            <span
              className="apple-symbol-tile apple-symbol-tile-blue"
              aria-hidden="true"
            >
              <Scale className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2 className="text-2xl font-bold text-slate-800">
                Pengukuran Balita
              </h2>
              <p className="truncate text-sm text-slate-500">
                {child.nama} - {getAgeInMonths(child.tglLahir)} Bulan -{" "}
                {child.desa} / {child.posyandu}
              </p>
            </div>
          </div>
        </div>
        <div
          className="measurement-segmented apple-segmented-control"
          role="tablist"
          aria-label="Menu penimbangan"
        >
          <button
            type="button"
            role="tab"
            aria-selected={menu === "history"}
            className={menu === "history" ? "is-active" : ""}
            onClick={() => setMenu("history")}
          >
            {menu === "history" ? (
              <motion.span
                layoutId="measurement-mode-pill"
                className="measurement-segment-pill"
                transition={segmentTransition}
                aria-hidden="true"
              />
            ) : null}
            <span className="measurement-segment-content">
              <History className="h-4 w-4" />
              <span>Riwayat</span>
            </span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={menu === "add"}
            className={menu === "add" ? "is-active" : ""}
            onClick={startAdd}
          >
            {menu === "add" ? (
              <motion.span
                layoutId="measurement-mode-pill"
                className="measurement-segment-pill"
                transition={segmentTransition}
                aria-hidden="true"
              />
            ) : null}
            <span className="measurement-segment-content">
              <Plus className="h-4 w-4" />
              <span>Tambah</span>
            </span>
          </button>
        </div>
      </div>
      {historyError ? (
        <div
          role="alert"
          className="ios-inline-notification ios-inline-notification-error"
        >
          <strong>Riwayat penimbangan tidak dapat dimuat</strong>
          <span>{historyError}</span>
        </div>
      ) : null}
      {menu === "history" ? (
        <Card className="ios-table-card measurement-history-card">
          <div className="measurement-history-heading">
            <div>
              <h3>Riwayat Penimbangan</h3>
              <p>{monthlyHistory.length} catatan pengukuran</p>
            </div>
            <div className="measurement-history-tools">
              {monthlyHistory.length ? (
                <AppButton
                  type="button"
                  variant="secondary"
                  className="measurement-growth-button"
                  onClick={() => setShowCharts(true)}
                  title="Buka grafik pertumbuhan WHO"
                >
                  <TrendingUp className="h-4 w-4" />
                  <span>Grafik Pertumbuhan</span>
                  <span className="measurement-growth-badge" aria-label={`${monthlyHistory.length} catatan`}>
                    {monthlyHistory.length}
                  </span>
                </AppButton>
              ) : null}
              {!monthlyHistory.length ? (
                <span
                  className="measurement-history-count"
                  aria-label="Belum ada catatan"
                >
                  0
                </span>
              ) : null}
            </div>
          </div>
          {loadingHistory ? (
            <>
              <div className="measurement-history-scroll measurement-history-desktop-only">
                <table
                  className="ios-data-table ios-measurement-table text-xs"
                  aria-busy="true"
                >
                  <thead>
                    <tr>
                      {tableHeaders.map((label) => (
                        <th key={label}>{label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 6 }, (_, index) => (
                      <tr key={index} className="app-table-loading-row">
                        {tableHeaders.map((_, cellIndex) => (
                          <td key={cellIndex}>
                            <SkeletonBlock className="app-table-cell-skeleton app-table-cell-skeleton-line" />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="measurement-mobile-history measurement-history-mobile-only" aria-busy="true">
                {Array.from({ length: 3 }, (_, index) => (
                  <div className="measurement-mobile-card" key={index}>
                    <SkeletonBlock className="h-5 w-2/5 rounded-lg" />
                    <div className="grid grid-cols-4 gap-2">
                      {Array.from({ length: 4 }, (_, metricIndex) => (
                        <SkeletonBlock className="h-12 rounded-xl" key={metricIndex} />
                      ))}
                    </div>
                    <SkeletonBlock className="h-6 w-full rounded-full" />
                  </div>
                ))}
              </div>
            </>
          ) : monthlyHistory.length === 0 ? (
            <p className="measurement-history-empty">
              Belum ada riwayat pengukuran.
            </p>
          ) : (
            <>
              <div className="measurement-history-scroll measurement-history-desktop-only">
                <table
                  className="ios-data-table ios-measurement-table text-xs"
                  data-measurement-history-table="true"
                >
                  <thead>
                    <tr>
                      {tableHeaders.map((label) => (
                        <th key={label}>{label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyHistory.map((item) => {
                      return (
                        <tr key={item.id} className="ios-data-row">
                          <td className="font-semibold uppercase whitespace-nowrap">
                            {measurementMonthLabel(item.tglUkur)}
                          </td>
                          <td className="whitespace-nowrap">
                            {formatIndoDate(item.tglUkur)}
                          </td>
                          <td className="text-center">{item.bb ?? "-"}</td>
                          <td className="text-center">{item.tb ?? "-"}</td>
                          <td className="text-center">{item.lila ?? "-"}</td>
                          <td className="text-center">{item.lk ?? "-"}</td>
                          <td className="text-center">
                            <KenaikanBadge status={String(item.statusNaik || "-")} />
                          </td>
                          <td>
                            <div className="flex items-center justify-center gap-2">
                              {actionButton("edit", item)}
                              {actionButton("delete", item)}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="measurement-mobile-history measurement-history-mobile-only">
                {monthlyHistory.map(mobileMeasurementCard)}
              </div>
            </>
          )}
        </Card>
      ) : (
        <Card className="ios-measurement-form measurement-form-card">
          <form onSubmit={save} className="measurement-form-stack space-y-6">
            <section className="measurement-form-section measurement-time-section">
              <div className="measurement-form-section-copy">
                <h3>Tanggal &amp; Cara Ukur</h3>
                <p>Tanggal pencatatan dan metode pengukuran disesuaikan dengan usia balita.</p>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {field("tglUkur", "Tanggal Pengukuran")}
                <InputGroup label="Cara Ukur">
                  <GlassInput
                    readOnly
                    className={`${inputClass} measurement-input-readonly`}
                    value={form.caraUkur || measurementMethodForAge(ageAtMeasure)}
                  />
                </InputGroup>
              </div>
            </section>
            <section className="measurement-form-section measurement-anthropometry-section">
              <div className="measurement-form-section-copy">
                <h3>Antropometri</h3>
                <p>Masukkan hasil penimbangan dan pengukuran tubuh balita.</p>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {field("bb", "Berat Badan (kg)")}
                {field(
                  "tb",
                  ageAtMeasure < 24 ? "Panjang Badan (cm)" : "Tinggi Badan (cm)",
                )}
                {showLila ? field("lila", "LILA (cm)") : null}
                {field("lk", "Lingkar Kepala (cm)")}
              </div>
            </section>
            <section className="measurement-form-section measurement-service-section">
              <div className="measurement-form-section-copy">
                <h3>Edema &amp; Layanan Balita</h3>
                <p>Lengkapi kondisi edema, kelas ibu, serta layanan tambahan yang diterima.</p>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {select(
                  "edema",
                  "Pitting Edema Bilateral",
                  simpleOptions([
                    "Tidak",
                    "Ada (Derajat +1)",
                    "Ada (Derajat +2)",
                    "Ada (Derajat +3)",
                  ]),
                )}
                {select(
                  "kelasIbu",
                  "Kelas Ibu Balita?",
                  simpleOptions(["Tidak", "Ya"]),
                )}
                <InputGroup label="Terima MBG?">
                  <AppSelect
                    value={form.mbg}
                    options={simpleOptions(["Tidak", "Ya"])}
                    className="measurement-select-field"
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        mbg: event.target.value,
                      }))
                    }
                  />
                </InputGroup>
                {showVitA
                  ? select(
                      "vitA",
                      "Dapat Vitamin A (Feb/Agu)?",
                      simpleOptions(["Tidak", "Ya"]),
                    )
                  : null}
                {showAsi ? (
                  <InputGroup label={asiLabel}>
                    <AppSelect
                      value={form.asi}
                      options={simpleOptions(["Tidak", "Ya"])}
                      className="measurement-select-field"
                      onChange={(event) => {
                        setAsiTouched(true);
                        setForm((current) => ({
                          ...current,
                          asi: event.target.value,
                        }));
                      }}
                    />
                  </InputGroup>
                ) : null}
              </div>
              <div className="measurement-info-box" role="note">
                <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                <p>Balita yang menerima MBG dari Posyandu atau PAUD/TK dapat dicatat melalui pilihan MBG.</p>
              </div>
            </section>
            <div className="measurement-form-actions flex gap-3 pt-2">
              <AppButton
                variant="secondary"
                type="button"
                onClick={() => setMenu("history")}
                className="measurement-form-cancel flex-1"
              >
                <ChevronLeft className="h-4 w-4" /> Kembali ke Riwayat
              </AppButton>
              <AppButton type="submit" disabled={saving} className="measurement-form-save flex-1">
                <CheckCircle2 className="h-4 w-4" />
                {saving
                  ? "Menyimpan..."
                  : editingId
                    ? "Simpan Perubahan"
                    : "Simpan Pengukuran"}
              </AppButton>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}
