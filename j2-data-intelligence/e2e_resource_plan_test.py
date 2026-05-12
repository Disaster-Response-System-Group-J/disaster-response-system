"""
End-to-end test: IoT row → iot_predictions + ResourcePlan

What this covers:
  1. Creates DivisionResources table (if not yet in Supabase) and seeds Moratuwa data.
  2. Inserts one synthetic flood row (high depth → likely Severe/Extreme).
  3. Inserts one synthetic landslide row (high moisture → likely Severe/Extreme).
  4. Mocks the Gemini call so the full pipeline runs without a real API key.
  5. Runs run_iot_prediction_cycle() directly.
  6. Prints iot_predictions and ResourcePlan rows written, then cleans up test data.

Run:
  cd j2-data-intelligence
  DATABASE_URL="postgresql://postgres:DisasterMangementSystem%40j2@db.qfhmczryyyddgitnlndy.supabase.co:5432/postgres" \
    python e2e_resource_plan_test.py
"""

import os, sys, uuid, json
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

# ── make project importable ───────────────────────────────────────────────────
sys.path.insert(0, os.path.dirname(__file__))

DB_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://postgres:DisasterMangementSystem%40j2@db.qfhmczryyyddgitnlndy.supabase.co:5432/postgres",
)
os.environ["DATABASE_URL"] = DB_URL
os.environ.setdefault("GEMINI_API_KEY", "test-mock-key")   # planner checks for non-empty key

import psycopg2
from urllib.parse import urlparse, unquote

# Parse URL to get raw psycopg2 kwargs (handles the @ in password correctly)
parsed = urlparse(DB_URL)
PG_CONN = dict(
    host=parsed.hostname,
    port=parsed.port or 5432,
    dbname=parsed.path.lstrip("/"),
    user=parsed.username,
    password=unquote(parsed.password or ""),
    connect_timeout=15,
)

# ── helpers ───────────────────────────────────────────────────────────────────

def pg():
    return psycopg2.connect(**PG_CONN)


def section(title: str) -> None:
    print(f"\n{'─'*60}\n  {title}\n{'─'*60}")


# ── step 1: ensure DivisionResources table exists ────────────────────────────

section("STEP 1 — Ensure DivisionResources table + Moratuwa row")

with pg() as conn:
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
        # Upsert Moratuwa resources (division_id = 121)
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

# ── step 2: insert synthetic IoT rows ────────────────────────────────────────

section("STEP 2 — Insert synthetic iot_flood and iot_landslide rows")

FLOOD_ID     = f"test-flood-{uuid.uuid4()}"
LANDSLIDE_ID = f"test-landslide-{uuid.uuid4()}"
NOW          = datetime.now(timezone.utc)

with pg() as conn:
    with conn.cursor() as cur:
        # High depth → very likely Severe/Extreme flood prediction
        cur.execute(
            'INSERT INTO public.iot_flood (id, type, temp, hum, depth, created_at) '
            'VALUES (%s, %s, %s, %s, %s, %s)',
            (FLOOD_ID, "flood", 31.5, 92, 18.0, NOW),
        )
        # High moisture + strong vibration → very likely Severe/Extreme landslide
        cur.execute(
            'INSERT INTO public.iot_landslide '
            '(id, type, temp, hum, moist, ax, ay, az, gx, gy, gz, created_at) '
            'VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)',
            (LANDSLIDE_ID, "landslide", 28.0, 88, 3500, 420, 380, 950, 210, 190, 480, NOW),
        )
        conn.commit()
        print(f"  Inserted flood    id={FLOOD_ID}")
        print(f"  Inserted landslide id={LANDSLIDE_ID}")

# ── step 3: mock Gemini and run prediction cycle ──────────────────────────────

section("STEP 3 — Run iot_prediction_cycle (Gemini mocked)")

MOCK_PLAN = {
    "situation_summary": "Moratuwa faces elevated flood risk with water depth at critical levels. Immediate deployment of emergency resources is required.",
    "risk_level": "Severe",
    "consideration_score": 0.1182,
    "immediate_actions": [
        "Pre-position 10 ambulances at flood-prone zones",
        "Open all 12 emergency shelters",
        "Distribute 5 tons of food to evacuation centres",
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
    "escalation_reason": "Ambulance count insufficient for projected casualty load at Severe flood level.",
}

mock_response      = MagicMock()
mock_response.text = json.dumps(MOCK_PLAN)
mock_client        = MagicMock()
mock_client.models.generate_content.return_value = mock_response

# Count rows before
with pg() as conn:
    with conn.cursor() as cur:
        cur.execute('SELECT COUNT(*) FROM public."ResourcePlan"')
        plans_before = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM public.iot_predictions WHERE source_id IN (%s, %s)",
                    (FLOOD_ID, LANDSLIDE_ID))
        preds_before = cur.fetchone()[0]

print(f"  Before: iot_predictions={preds_before}, ResourcePlan rows={plans_before}")

with patch("google.genai.Client", return_value=mock_client):
    from app.services.iot_event_handler import run_iot_prediction_cycle
    run_iot_prediction_cycle()

# ── step 4: verify results ────────────────────────────────────────────────────

section("STEP 4 — Verify results")

with pg() as conn:
    with conn.cursor() as cur:
        # iot_predictions written?
        cur.execute("""
            SELECT source_id, disaster_type, horizon, predicted_status
            FROM public.iot_predictions
            WHERE source_id IN (%s, %s)
            ORDER BY source_id, horizon
        """, (FLOOD_ID, LANDSLIDE_ID))
        pred_rows = cur.fetchall()
        print(f"\n  iot_predictions ({len(pred_rows)} rows):")
        for r in pred_rows:
            print(f"    source={r[0][:20]}…  type={r[1]:10s}  H={r[2]}  status={r[3]}")

        # ResourcePlan rows added?
        cur.execute('SELECT COUNT(*) FROM public."ResourcePlan"')
        plans_after = cur.fetchone()[0]
        new_plans   = plans_after - plans_before

        cur.execute("""
            SELECT plan_id, status, divisions_analyzed,
                   plan_json->>'risk_level'       AS risk_level,
                   plan_json->>'situation_summary' AS summary,
                   generated_at
            FROM public."ResourcePlan"
            ORDER BY generated_at DESC
            LIMIT %s
        """, (max(new_plans, 1),))
        plan_rows = cur.fetchall()

        print(f"\n  ResourcePlan new rows: {new_plans}")
        for r in plan_rows:
            print(f"    plan_id          = {r[0]}")
            print(f"    status           = {r[1]}")
            print(f"    divisions_analyzed = {r[2]}")
            print(f"    risk_level       = {r[3]}")
            print(f"    summary          = {(r[4] or '')[:80]}…")
            print(f"    generated_at     = {r[5]}")
            print()

# ── step 5: cleanup ───────────────────────────────────────────────────────────

section("STEP 5 — Cleanup test data")

with pg() as conn:
    with conn.cursor() as cur:
        cur.execute("DELETE FROM public.iot_predictions WHERE source_id IN (%s, %s)",
                    (FLOOD_ID, LANDSLIDE_ID))
        cur.execute("DELETE FROM public.iot_flood WHERE id = %s",     (FLOOD_ID,))
        cur.execute("DELETE FROM public.iot_landslide WHERE id = %s", (LANDSLIDE_ID,))
        conn.commit()
        print(f"  Removed synthetic flood/landslide rows and their predictions.")
        print(f"  ResourcePlan rows kept (status=DRAFT) for your review.")

# ── summary ───────────────────────────────────────────────────────────────────

section("RESULT")
ok = len(pred_rows) == 8 and new_plans >= 1   # 4 horizons × 2 sensors = 8 pred rows

if ok:
    print(f"  ✓ PASS — {len(pred_rows)} iot_predictions written, {new_plans} ResourcePlan row(s) inserted")
else:
    missing = []
    if len(pred_rows) != 8:
        missing.append(f"expected 8 iot_predictions, got {len(pred_rows)}")
    if new_plans < 1:
        missing.append("expected ≥1 new ResourcePlan row, got 0")
    print(f"  ✗ FAIL — {', '.join(missing)}")
    sys.exit(1)
