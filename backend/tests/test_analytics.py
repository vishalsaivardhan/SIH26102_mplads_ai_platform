from pathlib import Path

from analytics import allocation_records, allocation_summary, state_summary

DATA_PATH = Path(__file__).resolve().parents[1] / "data" / "Allocated Limit for Honble MPs.csv"


def test_real_dataset_is_loaded_and_missing_amounts_are_counted():
    summary = allocation_summary(DATA_PATH)

    assert summary["total_records"] == 544
    assert summary["scored_records"] + summary["missing_amounts"] == summary["total_records"]
    assert summary["model"] == "Isolation Forest"
    assert summary["model_scope"] == "Allocation amount outlier screening only"


def test_model_flags_a_small_review_queue_with_explanations():
    records = allocation_records(DATA_PATH)
    scored = [record for record in records if record["allocated_amount"] is not None]
    flagged = [record for record in records if record["is_outlier"]]

    assert 0 < len(flagged) < len(scored) * 0.05
    assert all(record["risk_level"] == "review" for record in flagged)
    assert all("Isolation Forest" in record["explanation"] for record in flagged)
    assert all("fraud" not in record["explanation"].lower() for record in flagged)


def test_state_rollups_cover_each_source_record():
    records = allocation_records(DATA_PATH)
    summaries = state_summary(DATA_PATH)

    assert len(summaries) == 37
    assert sum(summary["record_count"] for summary in summaries) == len(records)
    assert sum(summary["outlier_count"] for summary in summaries) == sum(
        record["is_outlier"] for record in records
    )