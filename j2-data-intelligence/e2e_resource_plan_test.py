"""
Manual E2E test: IoT row → iot_predictions + ResourcePlan

Run directly (NOT via pytest in CI):
  cd j2-data-intelligence
  DATABASE_URL="postgresql://postgres:DisasterMangementSystem%40j2@db.qfhmczryyyddgitnlndy.supabase.co:5432/postgres" \
    python e2e_resource_plan_test.py

Or via pytest locally (requires live DB):
  DATABASE_URL="..." pytest e2e_resource_plan_test.py -v -s
"""

import os
import sys
import uuid
import json
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch
from urllib.parse import urlparse, unquote

import pytest

# ── CI guard — skip entirely when running in GitHub Actions ──────────────────
pytestmark = pytest.mark.skipif(
    bool(os.environ.get("CI")),
    reason="Requires live Supabase connection — run manually outside CI",
)

DB_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://postgres:DisasterMangementSystem%40j2@db.qfhmczryyyddgitnlndy.supabase.co:5432/postgres",
)

sys.path.insert(0, os.path.dirname(__file__))
os.environ["DATABASE_URL"] = DB_URL
os.environ.setdefault("GEMINI_API_KEY", "test-mock-key")

import psycopg2  # noqa: E402 — after sys.path setup

parsed = urlparse(DB_URL)
PG_CONN = dict(
    host=parsed.hostname,
    port=parsed.port or 5432,
    dbname=parsed.path.lstrip("/"),
    user=parsed.username,
    password=unquote(parsed.password or ""),
    connect_timeout=15,
)

MOCK_PLAN = {
    "situation_summary": "Moratuwa faces elevated flood risk. Immediate deployment of emergency resources is required.",
    "risk_level": "Severe",
    "consideration_score": 0.1182,
    "immediate_actions": [
        "Pre-position 10 ambulances at flood-prone zones",
        "Open all 12 emergency shelters",
    ],
    "resource_assessment": {
        "hospital_bed_capacity":       {"value": 450,    "status": "insufficient"},
        "emergency_shelters":          {"value": 12,     "status": "insufficient"},
        "ambulance_count":             {"value": 28,     "status": "critical"},
        "food_stock_tons":             {"value": 18.5,   "status": "insufficient"},
        "clean_water_capacity_liters": {"value": 500000, "status": "adequate"},
        "power_grid_resilience":       {"value": 0.65,   "status": "adequate"},
    },
    "external_assistance_required": True,
    "escalation_reason": "Ambulance count insufficient for projected casualty load.",
}


def _pg():
    return psycopg2.connect(**PG_CONN)


def _section(title: str) -> None:
    print(f"\n{'─'*60}\n  {title}\n{'─'*60}")


def test_iot_to_resource_plan_e2e():
    """
    Full pipeline: synthetic IoT row → iot_predictions (H0–H3) → ResourcePlan (DRAFT).
    Gemini is mocked so no API key is needed.
    """
    # ── step 1: DivisionResources table + Moratuwa seed ──────────────────────
    _section("STEP 1 — Ensure DivisionResources table + Moratuwa row")
    with _pg() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS public."DivisionResources" (
                    division_id              integer PRIMARY KEY
                        REFERENCES public."Division"(division_id),
                    hospital_bed_capacity    integer,
                    emergency_shelters       integer,
                    ambulance_count          integer,
                    food_stock_tons          double precision,
                    clean_water_capacity_liters double precision,
                    power_grid_resilience    double precision
                )
            """)
            cur.execute("""
                INSERT INTO public."DivisionResources"
                  (division_id, hospital_bed_capacity, emergency_shelters, ambulance_count,
                   food_stock_tons, clean_water_capacity_liters, power_grid_resilience)
                VALUES (121, 450, 12, 28, 18.5, 500000, 0.65)
                ON CONFLICT (division_id) DO UPDATE SET
                  hospital_bed_capacity       = EXCLUDED.hospital_bed_capacity,
                  emergency_shelters          = EXCLUDED.emergency_shelters,
                  ambulance_count             = EXCLUDED.ambulance_count,
                  food_stock_tons             = EXCLUDED.food_stock_tons,
                  clean_water_capacity_liters = EXCLUDED.clean_water_capacity_liters,
                  power_grid_resilience       = EXCLUDED.power_grid_resilience
            """)
            conn.commit()
            cur.execute('SELECT * FROM public."DivisionResources" WHERE division_id = 121')
            row = cur.fetchone()
            print(f"  Moratuwa DivisionResources: {row}")

    # ── step 2: insert synthetic IoT rows ────────────────────────────────────
    _section("STEP 2 — Insert synthetic iot_flood and iot_landslide rows")
    flood_id     = f"test-flood-{uuid.uuid4()}"
    landslide_id = f"test-landslide-{uuid.uuid4()}"
    now          = datetime.now(timezone.utc)

    with _pg() as conn:
        with conn.cursor() as cur:
            cur.execute(
                'INSERT INTO public.iot_flood (id, type, temp, hum, depth, created_at) '
                'VALUES (%s, %s, %s, %s, %s, %s)',
                (flood_id, "flood", 31.5, 92, 18.0, now),
            )
            cur.execute(
                'INSERT INTO public.iot_landslide '
                '(id, type, temp, hum, moist, ax, ay, az, gx, gy, gz, created_at) '
                'VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)',
                (landslide_id, "landslide", 28.0, 88, 3500, 420, 380, 950, 210, 190, 480, now),
            )
            conn.commit()
            print(f"  flood id    = {flood_id}")
            print(f"  landslide id = {landslide_id}")

    # ── step 3: count before ─────────────────────────────────────────────────
    with _pg() as conn:
        with conn.cursor() as cur:
            cur.execute('SELECT COUNT(*) FROM public."ResourcePlan"')
            plans_before = cur.fetchone()[0]
            cur.execute(
                "SELECT COUNT(*) FROM public.iot_predictions WHERE source_id IN (%s, %s)",
                (flood_id, landslide_id),
            )
            preds_before = cur.fetchone()[0]
    print(f"\n  Before: iot_predictions={preds_before}, ResourcePlan={plans_before}")

    # ── step 4: run cycle with mocked Gemini ─────────────────────────────────
    _section("STEP 3 — Run iot_prediction_cycle (Gemini mocked)")
    mock_response      = MagicMock()
    mock_response.text = json.dumps(MOCK_PLAN)
    mock_client        = MagicMock()
    mock_client.models.generate_content.return_value = mock_response

    with patch("google.genai.Client", return_value=mock_client):
        from app.services.iot_event_handler import run_iot_prediction_cycle
        run_iot_prediction_cycle()

    # ── step 5: verify ───────────────────────────────────────────────────────
    _section("STEP 4 — Verify results")
    with _pg() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT source_id, disaster_type, horizon, predicted_status
                FROM public.iot_predictions
                WHERE source_id IN (%s, %s)
                ORDER BY source_id, horizon
            """, (flood_id, landslide_id))
            pred_rows = cur.fetchall()

            cur.execute('SELECT COUNT(*) FROM public."ResourcePlan"')
            plans_after = cur.fetchone()[0]
            new_plans = plans_after - plans_before

            cur.execute("""
                SELECT plan_id, status, divisions_analyzed,
                       plan_json->>'risk_level' AS risk_level,
                       generated_at
                FROM public."ResourcePlan"
                ORDER BY generated_at DESC
                LIMIT %s
            """, (max(new_plans, 1),))
            plan_rows = cur.fetchall()

    print(f"\n  iot_predictions ({len(pred_rows)} rows):")
    for r in pred_rows:
        print(f"    {r[0][:22]}… type={r[1]:10s} H={r[2]} status={r[3]}")

    print(f"\n  ResourcePlan new rows: {new_plans}")
    for r in plan_rows:
        print(f"    plan_id={r[0]}  status={r[1]}  divisions={r[2]}  risk={r[3]}  at={r[4]}")

    # ── step 6: cleanup ──────────────────────────────────────────────────────
    _section("STEP 5 — Cleanup")
    with _pg() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM public.iot_predictions WHERE source_id IN (%s, %s)",
                        (flood_id, landslide_id))
            cur.execute("DELETE FROM public.iot_flood WHERE id = %s",     (flood_id,))
            cur.execute("DELETE FROM public.iot_landslide WHERE id = %s", (landslide_id,))
            conn.commit()
        print("  Removed synthetic rows. ResourcePlan DRAFT rows kept for review.")

    # ── assertions ───────────────────────────────────────────────────────────
    assert len(pred_rows) == 8, f"Expected 8 iot_predictions (4 horizons × 2 sensors), got {len(pred_rows)}"
    assert new_plans >= 1,      f"Expected ≥1 new ResourcePlan row, got {new_plans}"


# ── standalone execution ──────────────────────────────────────────────────────
if __name__ == "__main__":
    test_iot_to_resource_plan_e2e()
    print("\n✓ PASS")
