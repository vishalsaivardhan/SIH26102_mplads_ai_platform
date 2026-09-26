import os
from pathlib import Path

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

from analytics import allocation_records, allocation_summary, state_summary

app = FastAPI(
    title="MPLADS Allocation Monitoring API",
    description=(
        "Allocation-limit data quality and unsupervised outlier review. "
        "This service does not identify confirmed fraud or work-level anomalies."
    ),
    version="2.0.0",
)

origins = [origin.strip() for origin in os.getenv("FRONTEND_ORIGINS", "*").split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=origins != ["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)

DATA_PATH = Path(__file__).resolve().parent / "data" / "Allocated Limit for Honble MPs.csv"


@app.get("/health")
def health_check():
    return {"status": "ok", "dataset_available": DATA_PATH.is_file()}


@app.get("/")
def read_root():
    return {
        "message": "MPLADS allocation monitoring API",
        "docs": "/docs",
        "scope": "MP allocation limits; not individual works or expenditure",
    }


@app.get("/api/stats")
def get_dashboard_stats():
    return allocation_summary(DATA_PATH)


@app.get("/api/map")
def get_state_map_data():
    return {"data": state_summary(DATA_PATH)}


@app.get("/api/allocations")
def get_allocations(
    state: str | None = Query(default=None),
    risk_filter: str = Query(default="all", pattern="^(all|review|typical)$"),
    search: str | None = Query(default=None, max_length=120),
    limit: int = Query(default=100, ge=1, le=600),
    offset: int = Query(default=0, ge=0),
):
    records = allocation_records(DATA_PATH)
    if state:
        records = [record for record in records if record["state"] == state]
    if risk_filter == "review":
        records = [record for record in records if record["is_outlier"]]
    elif risk_filter == "typical":
        records = [record for record in records if not record["is_outlier"]]
    if search:
        query = search.casefold().strip()
        records = [
            record
            for record in records
            if any(
                query in str(record[field]).casefold()
                for field in ("mp_name", "state", "constituency", "allocation_id")
            )
        ]
    records.sort(key=lambda record: (record["is_outlier"], record["model_score"]), reverse=True)
    count = len(records)
    return {"count": count, "data": records[offset : offset + limit]}