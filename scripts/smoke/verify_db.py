"""Query Supabase and print the latest rows from all four J1→J2 tables.
Run after pub_flood.py, pub_landslide.py, post_sos.py.
Wait ~35 s for the APScheduler ML cycle before checking iot_predictions.
"""
import os
import psycopg2
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

URL = os.environ["DATABASE_URL"].replace("postgresql+psycopg2://", "postgresql://")
conn = psycopg2.connect(URL, connect_timeout=15)
cur = conn.cursor()

print("=== row counts ===")
for table in ["iot_flood", "iot_landslide", "iot_predictions", '"IncomingReport"']:
    cur.execute(f"SELECT COUNT(*) FROM public.{table}")
    print(f"  {table:22s} {cur.fetchone()[0]}")

print("\n=== latest iot_flood (3 rows) ===")
cur.execute("""
    SELECT id, device_id, depth, temp, hum, recorded_at
    FROM iot_flood ORDER BY recorded_at DESC LIMIT 3
""")
for r in cur.fetchall():
    print(" ", r)

print("\n=== latest iot_landslide (3 rows) ===")
cur.execute("""
    SELECT id, device_id, moist, temp, hum, recorded_at
    FROM iot_landslide ORDER BY recorded_at DESC LIMIT 3
""")
for r in cur.fetchall():
    print(" ", r)

print("\n=== iot_predictions for most-recent source (horizons 0-3) ===")
cur.execute("""
    SELECT source_id, disaster_type, horizon, predicted_status, predicted_at
    FROM iot_predictions
    WHERE predicted_at = (SELECT MAX(predicted_at) FROM iot_predictions)
    ORDER BY disaster_type, horizon
""")
for r in cur.fetchall():
    print(" ", r)

print("\n=== latest IncomingReport (3 rows) ===")
cur.execute("""
    SELECT id, source, "disasterType", district, "sosId", "verificationStatus", "createdAt"
    FROM public."IncomingReport"
    ORDER BY "createdAt" DESC LIMIT 3
""")
for r in cur.fetchall():
    print(" ", r)

conn.close()
print("\nDone.")
