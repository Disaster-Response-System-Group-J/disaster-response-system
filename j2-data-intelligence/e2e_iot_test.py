"""
End-to-end IoT prediction test.

Steps:
  1. Insert one row into iot_flood  (realistic sensor values)
  2. Insert one row into iot_landslide (realistic sensor values)
  3. Run the IoT prediction cycle (same code the scheduler calls every 30 s)
  4. Query iot_predictions and print the results
"""

import os
import sys
import uuid
from datetime import datetime, timezone

# ── path so we can import app.* without installing the package ────────────────
sys.path.insert(0, os.path.dirname(__file__))

os.environ["DATABASE_URL"] = (
    "postgresql://postgres:DisasterMangementSystem%40j2"
    "@db.qfhmczryyyddgitnlndy.supabase.co:5432/postgres"
)

import psycopg2
from app.services.iot_event_handler import run_iot_prediction_cycle

# ── DB connection (direct psycopg2 for inserts / result checks) ───────────────
DB_PARAMS = dict(
    host="db.qfhmczryyyddgitnlndy.supabase.co",
    port=5432,
    dbname="postgres",
    user="postgres",
    password="DisasterMangementSystem@j2",
    sslmode="require",
)

FLOOD_ID     = f"e2e-flood-{uuid.uuid4().hex[:8]}"
LANDSLIDE_ID = f"e2e-land-{uuid.uuid4().hex[:8]}"

# ── Helper ────────────────────────────────────────────────────────────────────
def banner(msg):
    print(f"\n{'='*60}")
    print(f"  {msg}")
    print(f"{'='*60}")


# ── 1. Insert test rows ───────────────────────────────────────────────────────
banner("STEP 1 — Inserting test rows")

conn = psycopg2.connect(**DB_PARAMS)
conn.autocommit = True
cur = conn.cursor()

# Flood row  (temp=29 °C, hum=80 %, depth=12 cm — moderately elevated)
cur.execute("""
    INSERT INTO iot_flood (id, type, temp, hum, depth, created_at)
    VALUES (%s, %s, %s, %s, %s, %s)
""", (FLOOD_ID, "flood", 29.0, 80, 12.5, datetime.now(timezone.utc)))
print(f"[flood]     inserted row  id={FLOOD_ID}")

# Landslide row (high soil moisture + moderate vibration → should score Moderate/Severe)
cur.execute("""
    INSERT INTO iot_landslide (id, type, temp, hum, moist, ax, ay, az, gx, gy, gz, created_at)
    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
""", (LANDSLIDE_ID, "landslide", 22.0, 75, 3100, 2, -1, 10, 3, 0, -1,
      datetime.now(timezone.utc)))
print(f"[landslide] inserted row  id={LANDSLIDE_ID}")

cur.close()
conn.close()


# ── 2. Run the prediction cycle ───────────────────────────────────────────────
banner("STEP 2 — Running IoT prediction cycle")
run_iot_prediction_cycle()
print("Prediction cycle completed.")


# ── 3. Read back results ──────────────────────────────────────────────────────
banner("STEP 3 — Checking iot_predictions table")

conn = psycopg2.connect(**DB_PARAMS)
cur = conn.cursor()

cur.execute("""
    SELECT source_id, disaster_type, predicted_status,
           temp, hum,
           depth_prev, depth,
           moist, ax, ay, az, gx, gy, gz,
           predicted_at
    FROM iot_predictions
    WHERE source_id IN (%s, %s)
    ORDER BY predicted_at
""", (FLOOD_ID, LANDSLIDE_ID))

rows = cur.fetchall()
cols = [d[0] for d in cur.description]

if not rows:
    print("ERROR: No predictions found — something went wrong!")
    sys.exit(1)

for row in rows:
    print()
    for col, val in zip(cols, row):
        print(f"  {col:<20} {val}")

cur.close()
conn.close()

banner("TEST PASSED" if len(rows) == 2 else f"PARTIAL — got {len(rows)}/2 predictions")
