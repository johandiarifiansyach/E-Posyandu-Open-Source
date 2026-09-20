// SPDX-License-Identifier: GPL-3.0-or-later


/** Deterministic WHO/LMS and SVG chart requests handled by the Python worker. */
// @ts-nocheck
import { apiRequest } from './legacyClient';

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const normalized = String(value).trim().replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function ageMonthsOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function exclusiveBreastfeedingValue(measurement) {
  return measurement?.asi ?? measurement?.exclusiveBreastfeeding ?? measurement?.exclusive_breastfeeding ?? null;
}

function weightGainStatusValue(measurement) {
  return measurement?.statusNaik ?? measurement?.weightGainStatus ?? measurement?.weight_gain_status ?? null;
}

/** Read the status calculated by the Python service, never a browser rule. */
export function pythonWeightGainStatus(assessment) {
  return assessment?.analysis?.weightGainStatus
    ?? assessment?.weightGainStatus
    ?? assessment?.weight_gain_status
    ?? null;
}

/**
 * A result is usable for display when Python has persisted at least one
 * derived field.  During a rolling read fallback the pending flag may be
 * stale even though the response already contains valid statuses; callers
 * should keep those values visible instead of replacing them with a skeleton.
 */
export function hasUsableAnalysis(assessment) {
  if (!assessment || typeof assessment !== 'object') return false;
  const values = [
    assessment.bbuStatus,
    assessment.tbuStatus,
    assessment.bbtbStatus,
    assessment.imtuStatus,
    assessment.lilaStatus,
    assessment.lkStatus,
    assessment.exclusiveBreastfeedingStatus,
    assessment.analysis,
  ];
  return values.some((value) => {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') {
      const text = value.trim();
      return text.length > 0 && text !== '-';
    }
    if (typeof value === 'object') return Object.keys(value).length > 0;
    return true;
  });
}

function analysisItem(child, measurement, history) {
  const currentId = String(measurement?.id || '');
  const historyPayload = (history || [])
    .filter((item) => String(item?.id || '') !== currentId)
    .filter((item) => item?.tglUkur)
    .map((item) => ({
      measurementDate: String(item.tglUkur).slice(0, 10),
      weightKg: numberOrNull(item.bb),
      heightCm: numberOrNull(item.tb),
      lilaCm: numberOrNull(item.lila),
      headCircumferenceCm: numberOrNull(item.lk),
      // Keep a missing historical age as null so the analysis service can
      // infer it from the measurement date and the current age.  Zero is a
      // valid newborn age and must not be used as a missing-value sentinel.
      ageMonths: ageMonthsOrNull(item.ageInMonths),
      sex: String(child?.jk || '').toUpperCase() === 'P' ? 'P' : 'L',
      measurementMethod: item.caraUkur || null,
      exclusiveBreastfeeding: exclusiveBreastfeedingValue(item),
      weightGainStatus: weightGainStatusValue(item),
    }));

  return {
    weightKg: numberOrNull(measurement?.bb),
    heightCm: numberOrNull(measurement?.tb),
    lilaCm: numberOrNull(measurement?.lila),
    headCircumferenceCm: numberOrNull(measurement?.lk),
    ageMonths: Number.isFinite(Number(measurement?.ageInMonths)) ? Number(measurement.ageInMonths) : 0,
    sex: String(child?.jk || '').toUpperCase() === 'P' ? 'P' : 'L',
    measurementMethod: measurement?.caraUkur || null,
    measurementDate: String(measurement?.tglUkur || '').slice(0, 10),
    exclusiveBreastfeeding: exclusiveBreastfeedingValue(measurement),
    weightGainStatus: weightGainStatusValue(measurement),
    rowNumber: 1,
    recordId: currentId || String(child?.id || ''),
    nik: String(child?.nik || ''),
    history: historyPayload,
  };
}

/**
 * Calculate WHO statuses synchronously through the authenticated operations
 * gateway. The endpoint is batched so a table page performs one Python call,
 * rather than one background job per child.
 */
export async function requestPythonAnthropometry(entries) {
  const items = (entries || [])
    .filter((entry) => entry?.measurement && entry?.child)
    .map((entry, index) => ({
      ...analysisItem(entry.child, entry.measurement, entry.history || []),
      rowNumber: index + 1,
    }));
  if (!items.length) return { items: [], total: 0, calculator: 'python-deterministic-lms' };
  return apiRequest('/analysis/anthropometry', {
    method: 'POST',
    body: JSON.stringify({ items }),
  });
}

/**
 * Render the selected WHO chart in the private Python service. This direct
 * request is intentionally separate from the background ML job: chart data is
 * small, deterministic, and should not wait behind the queue.
 */
export async function requestPythonGrowthChart(child, history, chartType) {
  const points = (history || [])
    .filter((item) => item?.tglUkur)
    .slice()
    .sort((left, right) => new Date(left.tglUkur).getTime() - new Date(right.tglUkur).getTime())
    .map((item) => {
      const date = String(item.tglUkur).slice(0, 10);
      const parsedAge = Number(item.ageInMonths);
      return {
        // Age is persisted/derived at the authenticated Python boundary. Do
        // not rederive it in the browser when an imported row is incomplete.
        ageMonths: Number.isFinite(parsedAge) ? parsedAge : null,
        weightKg: numberOrNull(item.bb),
        heightCm: numberOrNull(item.tb),
        lilaCm: numberOrNull(item.lila),
        headCircumferenceCm: numberOrNull(item.lk),
        measurementMethod: item.caraUkur || null,
        measurementDate: date,
        weightGainStatus: weightGainStatusValue(item),
      };
    })
    .filter((item) => Number.isFinite(item.ageMonths));
  return apiRequest('/analysis/growth-chart', {
    method: 'POST',
    body: JSON.stringify({
      chartType,
      sex: String(child?.jk || '').toUpperCase() === 'P' ? 'P' : 'L',
      // The Python SVG is also used for PNG/PDF export, so include the
      // location beside the child's name in the rendered chart identity.
      childName: [
        child?.nama || 'Balita',
        child?.posyandu ? `Posyandu: ${child.posyandu}` : '',
        child?.desa || child?.village ? `Desa: ${child.desa || child.village}` : '',
      ].filter(Boolean).join(' • '),
      language: 'id',
      points,
    }),
  });
}
