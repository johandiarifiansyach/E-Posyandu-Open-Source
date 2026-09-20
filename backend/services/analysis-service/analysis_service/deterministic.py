# Copyright (C) 2026 Johandi Arifiansyach

"""Deterministic longitudinal rules used by the Python analysis service.

The open-source distribution keeps the Python runtime for WHO/LMS scoring,
weight-gain monitoring, and exclusive-breastfeeding record normalization.  It
deliberately does not ship probabilistic models, model training, or prediction
endpoints.
"""

from __future__ import annotations

from datetime import date
import math
from typing import Any


WEIGHT_GAIN_THRESHOLDS_GRAMS = (
    (1, 800), (2, 900), (3, 800), (4, 600), (5, 500),
    (6, 400), (7, 400), (8, 300), (11, 300), (60, 200),
)
ASI_EXCLUSIVE_AGES = tuple(range(0, 7))


def _number(value: Any) -> float | None:
    if isinstance(value, bool):
        return None
    try:
        result = float(value)
    except (TypeError, ValueError):
        return None
    return result if math.isfinite(result) else None


def _date_key(item: dict[str, Any] | None) -> str:
    if not isinstance(item, dict):
        return ""
    return str(item.get("measurement_date") or item.get("measurementDate") or item.get("tglUkur") or "").strip()[:10]


def _field(item: dict[str, Any] | None, name: str) -> Any:
    if not isinstance(item, dict):
        return None
    if name in item:
        return item[name]
    if name == "exclusive_breastfeeding":
        return item.get("exclusiveBreastfeeding", item.get("asi"))
    aliases = {
        "weight_kg": "weightKg",
        "height_cm": "heightCm",
        "lila_cm": "lilaCm",
        "head_circumference_cm": "headCircumferenceCm",
        "measurement_method": "measurementMethod",
    }
    return item.get(aliases.get(name, name))


def _age_months(item: dict[str, Any] | None) -> float | None:
    value = item.get("age_months", item.get("ageMonths")) if isinstance(item, dict) else None
    if isinstance(value, str):
        try:
            value = float(value.strip().replace(",", "."))
        except ValueError:
            return None
    return _number(value)


def minimum_weight_gain_grams(age_months: Any) -> int | None:
    age = _number(age_months)
    if age is None:
        return None
    age = int(round(age))
    if age < 0 or age > 60:
        return None
    for upper_age, grams in WEIGHT_GAIN_THRESHOLDS_GRAMS:
        if age <= upper_age:
            return grams
    return None


def _month_index(value: str) -> int | None:
    try:
        year, month = (int(part) for part in value[:7].split("-"))
    except (TypeError, ValueError):
        return None
    return year * 12 + month if 1 <= month <= 12 else None


def _history_age(record: dict[str, Any], current: dict[str, Any], current_date: str) -> int | None:
    age = _age_months(record)
    if age is not None:
        return int(round(age))
    current_age = _age_months(current)
    record_month = _month_index(_date_key(record))
    current_month = _month_index(current_date)
    if current_age is None or record_month is None or current_month is None:
        return None
    return int(round(current_age - (current_month - record_month)))


def _normalized_asi(value: Any) -> str | None:
    if isinstance(value, bool):
        return "Ya" if value else "Tidak"
    if value is None:
        return None
    normalized = str(value).strip().casefold()
    if normalized in {"ya", "yes", "true", "1"}:
        return "Ya"
    if normalized in {"tidak", "no", "false", "0"}:
        return "Tidak"
    return None


def _asi_context(item: dict[str, Any], history: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    """Normalize the progressive 0–6 month ASI record without inference beyond the form rule."""

    records = [record for record in (history or []) if isinstance(record, dict)] + [item]
    observations: list[dict[str, Any]] = []
    for index, record in enumerate(records):
        value = _normalized_asi(_field(record, "exclusive_breastfeeding"))
        if value is None:
            continue
        age = _age_months(record)
        if age is None:
            age = _history_age(record, item, _date_key(item))
        if age is None:
            continue
        age = int(round(age))
        if age in ASI_EXCLUSIVE_AGES:
            observations.append({"age": age, "value": value, "date": _date_key(record), "order": index})

    observations.sort(key=lambda value: (value["date"], value["order"]))
    latest_by_age = {observation["age"]: observation for observation in observations}
    inferred_ages: list[int] = []
    current_age = _age_months(item)
    if current_age is not None:
        current_age = max(0, min(6, int(round(current_age))))

    if current_age == 0 and 0 not in latest_by_age:
        latest_by_age[0] = {"age": 0, "value": "Ya", "date": _date_key(item), "order": len(records), "inferred": True}
        inferred_ages.append(0)

    current_observation = latest_by_age.get(current_age) if current_age is not None else None
    if current_observation and current_observation.get("value") == "Ya" and current_age is not None:
        for age in range(current_age):
            if age not in latest_by_age:
                latest_by_age[age] = {
                    "age": age, "value": "Ya", "date": current_observation.get("date", ""),
                    "order": current_observation.get("order", 0), "inferred": True,
                }
                inferred_ages.append(age)

    missing_ages = [age for age in ASI_EXCLUSIVE_AGES if age not in latest_by_age]
    values = {value["value"] for value in latest_by_age.values()}
    if not missing_ages and values == {"Ya"}:
        status = "Ya"
    elif "Tidak" in values:
        status = "Tidak"
    elif observations or inferred_ages:
        status = "Belum lengkap"
    else:
        status = "Belum tercatat"
    return {
        "status": status,
        "observations": len(latest_by_age),
        "expectedObservations": len(ASI_EXCLUSIVE_AGES),
        "observedAges": sorted(latest_by_age),
        "missingAges": missing_ages,
        "inferredAges": sorted(set(inferred_ages)),
        "complete": not missing_ages,
        "period": "0-6 bulan",
    }


def _previous_measurement(item: dict[str, Any], history: list[dict[str, Any]]) -> dict[str, Any] | None:
    current_date = _date_key(item)
    records = [record for record in history if isinstance(record, dict)]
    if current_date:
        records = [record for record in records if _date_key(record) and _date_key(record) < current_date]
    records.sort(key=_date_key)
    return records[-1] if records else None


def calculate_weight_gain_status(
    item: dict[str, Any],
    previous: dict[str, Any] | None = None,
    age_months: Any | None = None,
) -> str | None:
    """Calculate the deterministic N/T/O/B status from raw measurements."""

    current_weight = _number(_field(item, "weight_kg"))
    if current_weight is None or not 0.1 <= current_weight <= 60:
        return None
    if previous is None:
        return "B"
    previous_weight = _number(_field(previous, "weight_kg"))
    if previous_weight is None or not 0.1 <= previous_weight <= 60:
        return "B"
    current_date, previous_date = _date_key(item), _date_key(previous)
    if current_date and previous_date:
        try:
            if abs((date.fromisoformat(current_date) - date.fromisoformat(previous_date)).days) > 45:
                return "O"
        except ValueError:
            pass
    minimum = minimum_weight_gain_grams(_age_months(item) if age_months is None else age_months)
    if minimum is None:
        return None
    return "N" if (current_weight - previous_weight) * 1000 >= minimum else "T"


def analyze_item(
    item: dict[str, Any],
    history: list[dict[str, Any]] | None = None,
    *,
    assessment: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Return WHO/LMS plus transparent monitoring fields; no prediction fields."""

    from . import who

    history = [record for record in (history or []) if isinstance(record, dict)]
    if assessment is None:
        assessment = who.assess_item(item)
    previous = _previous_measurement(item, history)
    asi = _asi_context(item, history)
    status = calculate_weight_gain_status(item, previous, _age_months(item))
    return {
        **assessment,
        "weight_gain_status": status,
        "weight_gain_minimum_grams": minimum_weight_gain_grams(_age_months(item)),
        "exclusive_breastfeeding_status": asi["status"],
        "exclusive_breastfeeding_context": asi,
        "nutrition_concern": None,
        "nutrition_education": None,
        "analysis_version": "python-deterministic-v1",
    }


__all__ = [
    "_asi_context",
    "analyze_item",
    "calculate_weight_gain_status",
    "minimum_weight_gain_grams",
]
