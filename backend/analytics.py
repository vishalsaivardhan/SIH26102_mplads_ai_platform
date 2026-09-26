from functools import lru_cache
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest

CONTAMINATION_RATE = 0.03
AMOUNT_COLUMN = "Allocated AMOUNT ( ₹ )"
REQUIRED_COLUMNS = {
    "Sr. No.",
    "State",
    "Hon'ble Members of Parliaments",
    "Constituency",
    AMOUNT_COLUMN,
}


@lru_cache(maxsize=4)
def _load_scored_records(path: str, modified_ns: int) -> tuple[list[dict[str, Any]], float]:
    del modified_ns
    frame = pd.read_csv(path)
    missing_columns = REQUIRED_COLUMNS.difference(frame.columns)
    if missing_columns:
        raise ValueError(f"Allocation dataset is missing required columns: {sorted(missing_columns)}")

    frame = frame.copy()
    frame[AMOUNT_COLUMN] = pd.to_numeric(frame[AMOUNT_COLUMN], errors="coerce")
    valid = frame[AMOUNT_COLUMN].notna() & (frame[AMOUNT_COLUMN] > 0)
    usable = frame.loc[valid]
    national_median = float(usable[AMOUNT_COLUMN].median()) if not usable.empty else 0.0

    frame["is_outlier"] = False
    frame["model_score"] = 0.0
    if len(usable) >= 10:
        features = np.log1p(usable[[AMOUNT_COLUMN]].to_numpy(dtype=float))
        model = IsolationForest(
            n_estimators=250,
            contamination=CONTAMINATION_RATE,
            random_state=42,
        )
        model.fit(features)
        decision_scores = model.decision_function(features)
        predictions = model.predict(features)
        score_range = float(np.ptp(decision_scores))
        normalized_scores = (
            (decision_scores.max() - decision_scores) / score_range * 100
            if score_range > 0
            else np.zeros(len(decision_scores))
        )
        frame.loc[valid, "is_outlier"] = predictions == -1
        frame.loc[valid, "model_score"] = normalized_scores

    records: list[dict[str, Any]] = []
    for row in frame.to_dict(orient="records"):
        amount = row[AMOUNT_COLUMN]
        outlier = bool(row["is_outlier"])
        if pd.isna(amount):
            explanation = "Allocation amount is missing; excluded from model scoring."
            status = "missing"
        elif outlier and national_median:
            ratio = float(amount) / national_median
            direction = "above" if ratio >= 1 else "below"
            explanation = (
                f"Isolation Forest review outlier: allocation is {abs(ratio - 1) * 100:.1f}% "
                f"{direction} the national median of Rs {national_median:,.0f}. "
                "Allocation limits alone do not establish misuse."
            )
            status = "review"
        else:
            explanation = "Not selected by the allocation outlier model; this is not an audit clearance."
            status = "typical"
        records.append(
            {
                "allocation_id": str(row["Sr. No."]),
                "state": str(row["State"]).strip(),
                "mp_name": str(row["Hon'ble Members of Parliaments"]).strip(),
                "constituency": str(row["Constituency"]).strip(),
                "allocated_amount": None if pd.isna(amount) else float(amount),
                "risk_level": status,
                "is_outlier": outlier,
                "model_score": round(float(row["model_score"]), 2),
                "explanation": explanation,
            }
        )
    return records, national_median


def _scored_records(path: Path) -> tuple[list[dict[str, Any]], float]:
    resolved = path.resolve()
    return _load_scored_records(str(resolved), resolved.stat().st_mtime_ns)


def allocation_records(path: Path) -> list[dict[str, Any]]:
    records, _ = _scored_records(path)
    return records


def allocation_summary(path: Path) -> dict[str, Any]:
    records, national_median = _scored_records(path)
    valid = [record for record in records if record["allocated_amount"] is not None]
    total_amount = sum(record["allocated_amount"] for record in valid)
    review_count = sum(record["is_outlier"] for record in records)
    return {
        "total_records": len(records),
        "scored_records": len(valid),
        "missing_amounts": len(records) - len(valid),
        "total_allocated_amount": round(total_amount, 2),
        "national_median_amount": round(national_median, 2),
        "review_outliers": review_count,
        "review_rate_percent": round(review_count / max(1, len(valid)) * 100, 2),
        "model": "Isolation Forest",
        "model_scope": "Allocation amount outlier screening only",
        "model_contamination": CONTAMINATION_RATE,
    }


def state_summary(path: Path) -> list[dict[str, Any]]:
    records = allocation_records(path)
    states: dict[str, list[dict[str, Any]]] = {}
    for record in records:
        states.setdefault(record["state"], []).append(record)

    result = []
    for state, state_records in states.items():
        valid = [record for record in state_records if record["allocated_amount"] is not None]
        flagged = sum(record["is_outlier"] for record in state_records)
        rate = flagged / max(1, len(valid))
        result.append(
            {
                "state": state,
                "record_count": len(state_records),
                "scored_count": len(valid),
                "outlier_count": flagged,
                "outlier_rate": round(rate, 4),
                "total_allocated_amount": round(
                    sum(record["allocated_amount"] for record in valid), 2
                ),
                "risk_level": "review" if flagged else "typical",
            }
        )
    return sorted(result, key=lambda item: item["state"])