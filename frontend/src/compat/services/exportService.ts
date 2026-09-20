// Copyright (C) 2026 Johandi Arifiansyach

// @ts-nocheck

export { ensureXlsx } from './xlsx';
export { getDocsForExport } from '../api/exportApi';
export { getSigiziMeasurementExport } from '../api/measurementApi';

import { getAgeInMonths } from '../shared/dashboardUtils';
import { DEFAULT_AGE_GROUP, matchesAgeGroup } from '../config/ageFilters';
import { measurementMethodForAge } from '../../features/measurements/measurementRules';
// PMT rules are owned by the React feature layer. Keep this export adapter
// independent from the removed native UI modules.
import { maxWeeksForCategory } from '../../features/pmt/pmtRules';

function weightGainStatus(measurement) {
  return measurement?.statusNaik ?? measurement?.weightGainStatus ?? measurement?.weight_gain_status ?? null;
}

export function getSelectedMonthRange(month, year) {
  const numericMonth = Number(month);
  const monthValue = String(numericMonth).padStart(2, '0');
  const start = `${year}-${monthValue}-01`;
  const lastDay = new Date(Number(year), numericMonth, 0).getDate();
  const end = `${year}-${monthValue}-${String(lastDay).padStart(2, '0')}`;
  return { start, end };
}

/**
 * Build a predictable, filesystem-safe export name using the active location
 * scope.  A selected posyandu is more specific than a desa, while an empty
 * scope represents all locations.
 */
export function getScopedExportFilename({ prefix, month, year, desa, posyandu }) {
  const sanitizePart = (value) => String(value ?? '')
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const parts = [sanitizePart(prefix) || 'Export'];
  const safePosyandu = sanitizePart(posyandu);
  const safeDesa = sanitizePart(desa);

  if (safePosyandu) parts.push(safePosyandu);
  if (safeDesa) parts.push(safeDesa);
  parts.push(sanitizePart(month) || 'Bulan', sanitizePart(year) || 'Tahun');
  return `${parts.join('_')}.xls`;
}

export function toDateValue(value) {
  const date = value instanceof Date
    ? value
    : value && typeof value.toDate === 'function'
      ? value.toDate()
      : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Export responses can come from the native API, an older cached document, or
 * the SQL projection.  Keep the adapters tolerant of both camelCase and
 * database-style snake_case names (and of a document nested under `data`).
 */
export function readExportField(record, ...keys) {
  const sources = [record, record?.data].filter((source) => source && typeof source === 'object');
  for (const source of sources) {
    for (const key of keys) {
      const value = source[key];
      if (value !== undefined && value !== null && (typeof value !== 'string' || value.trim() !== '')) {
        return value;
      }
    }
  }
  return '';
}

export function createdAtValue(value) {
  return toDateValue(readExportField(value, 'createdAt', 'created_at', 'tglUkur', 'measurement_date', 'tglPemberian'))?.getTime() || 0;
}

export function latestMeasurementsByChild(measurements) {
  return (measurements || []).reduce((result, measurement) => {
    const key = readExportField(measurement, 'childId', 'child_id', 'balitaId', 'legacy_child_id');
    if (!key) return result;
    const previous = result[key];
    const measurementDate = String(readExportField(measurement, 'tglUkur', 'measurement_date'));
    const previousDate = String(readExportField(previous, 'tglUkur', 'measurement_date'));
    if (!previous || measurementDate > previousDate || (measurementDate === previousDate && createdAtValue(measurement) > createdAtValue(previous))) {
      result[key] = measurement;
    }
    return result;
  }, {});
}

export function latestMpasiLogsByChild(logs) {
  return (logs || []).reduce((result, log) => {
    const key = readExportField(log, 'childId', 'child_id', 'balitaId', 'legacy_child_id');
    if (!key) return result;
    const previous = result[key];
    const logDate = String(readExportField(log, 'tglMonitoring', 'monitoring_date'));
    const previousDate = String(readExportField(previous, 'tglMonitoring', 'monitoring_date'));
    if (!previous || logDate > previousDate || (logDate === previousDate && createdAtValue(log) > createdAtValue(previous))) {
      result[key] = log;
    }
    return result;
  }, {});
}

export function filterChildrenByAgeRange(children, minimumAge, maximumAge, referenceDate) {
  return (children || []).filter((child) => {
    if (child?.deletedAt) return false;
    const age = getAgeInMonths(child?.tglLahir, referenceDate);
    return age >= minimumAge && age <= maximumAge;
  });
}

/** Apply the same named age cohort used by the table/dashboard filter. */
export function filterChildrenByAgeGroup(children, ageGroup = DEFAULT_AGE_GROUP, referenceDate = new Date()) {
  return (children || []).filter((child) => !child?.deletedAt && matchesAgeGroup(child, ageGroup, referenceDate));
}

export async function fetchExportDocuments({
  resource,
  dateField,
  start,
  end,
  options = {},
  db,
  appId,
  user,
  roles,
  viewDesa,
  viewPosyandu,
  collection,
  query,
  where,
  getDocsForExport,
}) {
  const constraints = [];
  if (dateField && start) constraints.push(where(dateField, '>=', start));
  if (dateField && end) constraints.push(where(dateField, '<=', end));

  if (!options.allLocations) {
    const scopedDesa = (user?.role === roles.GIZI || user?.role === roles.SUPER_ADMIN) ? viewDesa : user?.desa;
    const scopedPosyandu = user?.role === roles.KADER ? user.posyandu : viewPosyandu;
    if (scopedDesa) constraints.push(where('desa', '==', scopedDesa));
    if (scopedPosyandu) constraints.push(where('posyandu', '==', scopedPosyandu));
  }

  const source = collection(db, 'artifacts', appId, 'public', 'data', resource);
  const snapshot = await getDocsForExport(query(source, ...constraints));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

export async function fetchExportChildren({ currentFilterDate, ageGroup = DEFAULT_AGE_GROUP, options = {}, ...context }) {
  const children = await fetchExportDocuments({ resource: 'children', options, ...context });
  return filterChildrenByAgeGroup(children, ageGroup, currentFilterDate);
}

export function getMeasurementStatusesForExport(child, measurement, referenceDate, pythonStatus = null) {
  const age = pythonStatus?.ageInMonths ?? measurement?.ageInMonths ?? child?.ageInMonths ?? '-';
  if (pythonStatus) {
    return {
      age,
      statusBbu: pythonStatus.bbuStatus,
      statusTbu: pythonStatus.tbuStatus,
      statusBbtb: pythonStatus.bbtbStatus,
      statusImtu: pythonStatus.imtuStatus,
    };
  }
  // Never recreate WHO rules in the browser.  A missing Python result is
  // represented explicitly so exports cannot silently mix two calculators.
  return {
    age,
    statusBbu: '-',
    statusTbu: '-',
    statusBbtb: '-',
    statusImtu: '-',
    pythonRequired: true,
  };
}

export function filterChildrenForExportTab(activeTab, children, measurementsByChild, referenceDate, pythonStatuses = {}) {
  if (activeTab === 'problem_tidak_naik') return (children || []).filter((child) => {
    const measurement = measurementsByChild[child.id];
    return weightGainStatus(pythonStatuses[String(child.id)]) === 'T';
  });
  const criteria = {
    problem_underweight: ['BBU', ['Berat Sangat Kurang', 'Berat Kurang']],
    problem_stunting: ['TBU', ['Sangat Pendek', 'Pendek']],
    problem_wasting: ['BBTB', ['Gizi Buruk', 'Gizi Kurang']],
  }[activeTab];
  if (!criteria) return children || [];
  const [type, labels] = criteria;
  return (children || []).filter((child) => {
    const measurement = measurementsByChild[child.id];
    if (type === 'BBU' && !measurement?.bb) return false;
    if (type === 'TBU' && !measurement?.tb) return false;
    if (type === 'BBTB' && (!measurement?.bb || !measurement?.tb)) return false;
    const statuses = getMeasurementStatusesForExport(child, measurement, referenceDate, pythonStatuses[String(child.id)]);
    const status = type === 'TBU' ? statuses.statusTbu : type === 'BBTB' ? statuses.statusBbtb : statuses.statusBbu;
    return labels.includes(status);
  });
}

export function toExportBinary(value) {
  return value === 'Ya' || (Array.isArray(value) && value[0] === 'Ya') ? 1 : 0;
}

export const PMT_EXPORT_HEADERS = [
  'nik', 'nama', 'tanggal_pemberian_pertama', 'siklus_ke', 'jenis_pmt', 'sumber_anggaran',
  'mitra', 'mitra_lain', 'pmt_sesuai_juknis', 'alasan_pemberian', 'minggu_ke',
  'tanggal_pemantauan', 'hari_1', 'hari_2', 'hari_3', 'hari_4', 'hari_5', 'hari_6',
  'hari_7', 'bb', 'tb', 'cara_ukur', 'pemantauan_kesehatan', 'tindak_lanjut',
];

export const SIGIZI_IDENTITY_HEADERS = [
  'No', 'anak_ke', 'tgl_lahir', 'jenis_kelamin', 'nomor_KK', 'NIK', 'nama_anak',
  'usia_hamil', 'berat_lahir', 'panjang_lahir', 'lingkar_kepala_lahir', 'kia',
  'kia_bayi_kecil', 'imd', 'nama_ortu', 'nik_ortu', 'hp_ortu', 'alamat', 'rt', 'rw',
  'hapus', 'pindah',
];

export function getSigiziIdentityRows(children, filterMonth, filterYear) {
  return (children || [])
    .filter((child) => {
      const createdAt = toDateValue(child.createdAt);
      return createdAt && createdAt.getMonth() + 1 === Number(filterMonth) && createdAt.getFullYear() === Number(filterYear);
    })
    .map((child, index) => [
      index + 1,
      child.anakKe,
      child.tglLahir,
      child.jk === 'L' ? 'Laki-laki' : 'Perempuan',
      child.noKK,
      child.nik,
      child.nama,
      child.usiaKehamilan,
      child.bbLahir,
      child.pbLahir,
      child.lkLahir,
      child.bukuKIA,
      child.bukuKIAKecil,
      child.imd,
      child.namaOrtu,
      child.nikOrtu,
      child.noHpOrtu || '-',
      child.alamat || '',
      child.rt,
      child.rw,
      '',
      '',
    ]);
}

export const SIGIZI_MEASUREMENT_HEADERS = [
  'No', 'NIK', 'nama_anak', 'TANGGALUKUR', 'BERAT', 'TINGGI', 'LILA', 'lingkar_kepala',
  'Pitting_edema', 'CARAUKUR', 'vita', 'asi_bulan_0', 'asi_bulan_1', 'asi_bulan_2',
  'asi_bulan_3', 'asi_bulan_4', 'asi_bulan_5', 'asi_bulan_6', 'kelas_ibu_balita', 'mbg',
];

export function buildSigiziMeasurementExportItems(children, measurements, monthStart, monthEnd) {
  const measurementsByChild = new Map();
  (measurements || []).forEach((measurement) => {
    const childId = readExportField(measurement, 'childId', 'child_id', 'balitaId', 'legacy_child_id');
    if (!childId) return;
    const items = measurementsByChild.get(String(childId)) || [];
    items.push(measurement);
    measurementsByChild.set(String(childId), items);
  });

  return (children || [])
    .filter((child) => child?.id && !child.deletedAt)
    .sort((left, right) => String(left.nama || '').localeCompare(String(right.nama || ''), 'id'))
    .map((child) => {
      const childMeasurements = (measurementsByChild.get(String(child.id)) || [])
        .filter((measurement) => {
          const date = readExportField(measurement, 'tglUkur', 'measurement_date');
          return date && String(date) <= monthEnd;
        })
        .sort((left, right) => {
          const dateComparison = String(readExportField(right, 'tglUkur', 'measurement_date'))
            .localeCompare(String(readExportField(left, 'tglUkur', 'measurement_date')));
          return dateComparison || createdAtValue(right) - createdAtValue(left);
        });
      const current = childMeasurements.find((measurement) => String(readExportField(measurement, 'tglUkur', 'measurement_date')) >= monthStart) || null;
      const currentMeasurementDate = readExportField(current, 'tglUkur', 'measurement_date');
      const childBirthDate = readExportField(child, 'tglLahir', 'birth_date');
      const storedMeasurementMethod = readExportField(current, 'caraUkur', 'cara_ukur', 'measurement_method');
      const inferredMeasurementMethod = currentMeasurementDate && childBirthDate
        ? measurementMethodForAge(getAgeInMonths(
          childBirthDate,
          new Date(`${String(currentMeasurementDate).slice(0, 10)}T00:00:00`),
        ))
        : '';
      const asiByAge = new Map();
      childMeasurements.forEach((measurement) => {
        const measurementDate = readExportField(measurement, 'tglUkur', 'measurement_date');
        const age = getAgeInMonths(childBirthDate, new Date(`${String(measurementDate).slice(0, 10)}T00:00:00`));
        if (age < 0 || age > 6 || asiByAge.has(age)) return;
        asiByAge.set(age, readExportField(measurement, 'asi', 'exclusive_breastfeeding'));
      });
      if (asiByAge.get(6) === 'Ya') {
        for (let age = 0; age < 6; age += 1) {
          if (!asiByAge.get(age)) asiByAge.set(age, 'Ya');
        }
      }

      return {
        nik: child.nik || '',
        nama: child.nama || '',
        tglUkur: readExportField(current, 'tglUkur', 'measurement_date') || null,
        bb: readExportField(current, 'bb', 'weight_kg', 'weightKg') || null,
        tb: readExportField(current, 'tb', 'height_cm', 'heightCm', 'pb', 'pb_tb') || null,
        lila: readExportField(current, 'lila', 'mid_upper_arm_circumference_cm') || null,
        lk: readExportField(current, 'lk', 'head_circumference_cm') || null,
        edema: readExportField(current, 'edema') || '',
        caraUkur: storedMeasurementMethod || inferredMeasurementMethod,
        vitA: readExportField(current, 'vitA', 'vita', 'vitaminA', 'vitamin_a') || '',
        asiBulan0: asiByAge.get(0) || '',
        asiBulan1: asiByAge.get(1) || '',
        asiBulan2: asiByAge.get(2) || '',
        asiBulan3: asiByAge.get(3) || '',
        asiBulan4: asiByAge.get(4) || '',
        asiBulan5: asiByAge.get(5) || '',
        asiBulan6: asiByAge.get(6) || '',
        kelasIbu: readExportField(current, 'kelasIbu', 'kelasIbuHamil', 'kelas_ibu_balita', 'kelas_ibu_hamil', 'mother_class_attendance') || '',
        mbg: readExportField(current, 'mbg') || '',
      };
    });
}

export function getSigiziMeasurementRows(items) {
  return (items || []).map((row, index) => {
    let edemaValue = '';
    const edema = readExportField(row, 'edema');
    if (edema === 'Tidak') edemaValue = 'tidak';
    else if (edema?.includes?.('+1')) edemaValue = '1';
    else if (edema?.includes?.('+2')) edemaValue = '2';
    else if (edema?.includes?.('+3')) edemaValue = '3';

    const asiColumns = [
      readExportField(row, 'asiBulan0', 'asi_bulan_0'),
      readExportField(row, 'asiBulan1', 'asi_bulan_1'),
      readExportField(row, 'asiBulan2', 'asi_bulan_2'),
      readExportField(row, 'asiBulan3', 'asi_bulan_3'),
      readExportField(row, 'asiBulan4', 'asi_bulan_4'),
      readExportField(row, 'asiBulan5', 'asi_bulan_5'),
      readExportField(row, 'asiBulan6', 'asi_bulan_6'),
    ]
      .map((value) => value === 'Ya' ? 'ya' : value === 'Tidak' ? 'tidak' : '');

    return [
      index + 1,
      readExportField(row, 'nik', 'national_id'),
      readExportField(row, 'nama', 'name'),
      readExportField(row, 'tglUkur', 'measurement_date') || '',
      readExportField(row, 'bb', 'weight_kg') || '',
      readExportField(row, 'tb', 'height_cm', 'pb', 'pb_tb') || '',
      readExportField(row, 'lila', 'mid_upper_arm_circumference_cm') || '',
      readExportField(row, 'lk', 'head_circumference_cm') || '',
      edemaValue,
      String(readExportField(row, 'caraUkur', 'cara_ukur', 'measurement_method') || '').toLowerCase(),
      String(readExportField(row, 'vitA', 'vita', 'vitaminA', 'vitamin_a') || '').toLowerCase(),
      ...asiColumns,
      String(readExportField(row, 'kelasIbu', 'kelasIbuHamil', 'kelas_ibu_balita', 'kelas_ibu_hamil', 'mother_class_attendance') || '').toLowerCase(),
      String(readExportField(row, 'mbg') || '').toLowerCase(),
    ];
  });
}

export const TABLE_EXPORT_HEADERS = [
  'No', 'Nama', 'NIK', 'Jenis Kelamin', 'Tgl Lahir', 'Usia (Bln)', 'Nama Ortu', 'Desa',
  'Posyandu', 'BB (kg)', 'PB/TB (cm)', 'LILA (cm)', 'LK (cm)', 'Cara Ukur', 'Vitamin A',
  'Kelas Ibu Hamil', 'MBG', 'Status Naik', 'Status BB/U',
  'Status PB/TB-U', 'Status BB/PB atau BB/TB', 'Status IMT/U',
];

export function getTableExportRows({ activeTab, children, measurementsByChild, referenceDate, sortData = (items) => items, pythonStatuses = {}, pythonFiltered = false }) {
  // Problem/data tabs are already filtered and paginated by the Python
  // dataset operation. Keep the legacy helper for callers with raw data, but
  // never re-run a browser-side status filter for a Python response.
  const exportChildren = pythonFiltered
    ? (children || [])
    : filterChildrenForExportTab(activeTab, children, measurementsByChild, referenceDate, pythonStatuses);
  return sortData(exportChildren).map((child, index) => {
    if (!child?.id) return [];
    const measurement = measurementsByChild?.[child.id] || measurementsByChild?.[String(child.id)];
    const statuses = getMeasurementStatusesForExport(child, measurement, referenceDate, pythonStatuses[String(child.id)]);
    return [
      index + 1,
      child.nama,
      child.nik,
      child.jk === 'L' ? 'Laki-laki' : 'Perempuan',
      child.tglLahir,
      statuses.age,
      child.namaOrtu,
      child.desa,
      child.posyandu,
      readExportField(measurement, 'bb', 'weight_kg', 'weightKg') || '-',
      readExportField(measurement, 'tb', 'height_cm', 'heightCm', 'pb', 'pb_tb') || '-',
      readExportField(measurement, 'lila', 'mid_upper_arm_circumference_cm') || '-',
      readExportField(measurement, 'lk', 'head_circumference_cm') || '-',
      readExportField(measurement, 'caraUkur', 'cara_ukur', 'measurement_method') || '-',
      readExportField(measurement, 'vitA', 'vita', 'vitaminA', 'vitamin_a') || '-',
      readExportField(measurement, 'kelasIbu', 'kelasIbuHamil', 'kelas_ibu_balita', 'kelas_ibu_hamil', 'mother_class_attendance') || '-',
      readExportField(measurement, 'mbg') || '-',
      weightGainStatus(pythonStatuses[String(child.id)]) || '-',
      statuses.statusBbu,
      statuses.statusTbu,
      statuses.statusBbtb,
      statuses.statusImtu,
    ];
  });
}

export const MPASI_EXPORT_HEADERS = [
  'No', 'NIK', 'Nama', 'tgl_monitoring', 'asi', 'sereal', 'kacang', 'susu', 'daging/unggas',
  'telur', 'buah_sayur_vita', 'buah_sayur_lain', 'dapat_intervensi',
];

export function getMpasiExportRows(children, logsByChild) {
  return (children || []).map((child, index) => {
    const log = child?.id ? logsByChild[child.id] : null;
    const hasLog = Boolean(log);
    return [
      index + 1,
      child.nik,
      child.nama,
      hasLog ? log.tglMonitoring : '-',
      hasLog ? toExportBinary(log.asi) : 0,
      hasLog ? toExportBinary(log.makananPokok) : 0,
      hasLog ? toExportBinary(log.kacang) : 0,
      hasLog ? toExportBinary(log.susu) : 0,
      hasLog ? toExportBinary(log.daging) : 0,
      hasLog ? toExportBinary(log.telur) : 0,
      hasLog ? toExportBinary(log.sayurVitA) : 0,
      hasLog ? toExportBinary(log.sayurLain) : 0,
      hasLog ? toExportBinary(log.intervensiGizi) : 0,
    ];
  });
}

const mapJenisPmt = (value) => value === 'Pabrikan' ? 1 : 2;
const mapSumberAnggaran = (value) => ({ 'DAK Non Fisik': 1, APBD: 2, Mitra: 3, 'Dana Desa': 4 }[value] || 0);
const mapAlasan = (value) => ({ Wasting: 1, Underweight: 2, TidakNaik: 3 }[value] || 0);
const mapCaraUkur = (value) => value === 'Berdiri' ? 1 : 2;
const mapKesehatan = (value) => value === 'Ada' ? 1 : 0;
const mapTindakLanjut = (value) => ({ Dilanjutkan: 1, Selesai: 2, 'Rujuk RS': 3 }[value] || 0);
const mapSesuaiJuknis = (value) => value === 'Ya' ? 1 : 0;

const getProgramCategory = (program) => program?.category ?? program?.kategori;
const getChildById = (childById, id) => childById instanceof Map ? childById.get(id) : childById?.[id];
const getMonitoringForWeek = (program, week) => {
  const monitorings = program?.monitorings ?? program?.pemantauan;
  if (Array.isArray(monitorings)) {
    return monitorings.find((item) => Number(item?.week ?? item?.minggu) === week) || monitorings[week] || null;
  }
  return monitorings?.[week] ?? monitorings?.[String(week)] ?? null;
};

export function getPmtExportRows(category, programs, childById) {
  return (programs || [])
    .filter((program) => category === 'Semua' || getProgramCategory(program) === category)
    .flatMap((program) => {
      const child = getChildById(childById, program.childId || program.child_id) || {};
      const programCategory = getProgramCategory(program);
      return Array.from({ length: maxWeeksForCategory(programCategory) }, (_, index) => {
        const week = index + 1;
        const monitoring = getMonitoringForWeek(program, week);
        const days = monitoring?.days || [];
        return [
          child.nik || '', child.nama || '', program.tglPemberian || '', program.siklusKe || 1,
          mapJenisPmt(program.jenisPmt), mapSumberAnggaran(program.sumberAnggaran), program.mitra || '',
          program.mitraLain || '', mapSesuaiJuknis(program.pmtSesuaiJuknis), mapAlasan(programCategory), week,
          monitoring?.tgl || '', ...Array.from({ length: 7 }, (_, day) => days[day] ? 1 : 0),
          monitoring?.bb || '', monitoring?.tb || '', monitoring ? mapCaraUkur(monitoring.caraUkur) : '',
          monitoring ? mapKesehatan(monitoring.pemantauanKesehatan ?? monitoring.statusKesehatan) : '',
          monitoring ? mapTindakLanjut(monitoring.tindakLanjut) : '',
        ];
      });
    });
}
