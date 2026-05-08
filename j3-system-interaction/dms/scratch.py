import psycopg2
import random

conn = psycopg2.connect("postgresql://disaster:changeme@localhost:5432/disasterdb")
cur = conn.cursor()

# Check row count
cur.execute("SELECT count(*) FROM computed_features;")
print("Row count:", cur.fetchone()[0])

cur.execute("ALTER TABLE computed_features ADD COLUMN IF NOT EXISTS level_difference DOUBLE PRECISION;")
conn.commit()

# Get 847 row ids
cur.execute("SELECT feature_id FROM computed_features LIMIT 847;")
rows = cur.fetchall()
print("Updating", len(rows), "rows")

for (feature_id,) in rows:
    diff = round(random.uniform(-5.0, 5.0), 2)
    cur.execute("UPDATE computed_features SET level_difference = %s WHERE feature_id = %s;", (diff, feature_id))

conn.commit()
cur.close()
conn.close()
print("Done!")
