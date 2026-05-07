"""
Compute ML features from raw weather data and insert into computed_features table.
Matches temporal_split_pipeline.py SPI logic exactly.
"""

import os, math
import psycopg2
from psycopg2.extras import execute_values
import scipy.stats as stats
import numpy as np
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

DATABASE_URL = os.environ["DATABASE_URL"]

# sklearn LabelEncoder alphabetical mapping (from encode_divisions.py output)
DIVISION_ENCODING = {
    "Akurana":0,"Alawwa":1,"Ambalantota":2,"Ambanganga":3,"Aranayake":4,
    "Badulla":5,"Bibile":6,"Bulathkohipitiya":7,"Dambulla":8,"Dehiattakandiya":9,
    "Deltota":10,"Dimbulagala":11,"Doluwa":12,"Dompe":13,"Ehetuwewa":14,
    "Eravur Pattu":15,"Galenbidunuwewa":16,"Galgamuwa":17,"Ganga Ihala Korale":18,
    "Giribawa":19,"Gomarankadawala":20,"Hanguranketa":21,"Harispattuwa":22,
    "Hatharaliyadda":23,"Higurakgoda":24,"Horowpathana":25,"Ibbagamuwa":26,
    "Kahatagasdigiliya":27,"Kandavalai":28,"Kandeketiya":29,"Kantale":30,
    "Karachchi":31,"Karuwalagaswewa":32,"Kebithigollewa":33,"Kekirawa":34,
    "Kinniya":35,"Kolonna":36,"Koralai Pattu North":37,"Koralai Pattu South":38,
    "Kothmale East":39,"Kothmale West":40,"Kuchchaweli":41,"Kuruvita":42,
    "Laggala":43,"Lankapura":44,"Lunugala":45,"Mahawilachchiya":46,
    "Mahiyanganaya":47,"Mallawapitiya":48,"Mannar Town":49,"Manthai West":50,
    "Maritimepattu":51,"Matale":52,"Mathurata":53,"Mawanella":54,
    "Mawathagama":55,"Medadumbara":56,"Medawachchiya":57,"Medirigiriya":58,
    "Meegahakiula":59,"Mihinthale":60,"Minipe":61,"Morawewa":62,"Mundel":63,
    "Musali":64,"Muthur":65,"Nanaddan":66,"Naula":67,"Nildandahinna":68,
    "Nochchiyagama":69,"Norwood":70,"Nuwara Eliya":71,"Nuwaragam Palatha Central":72,
    "Oddusuddan":73,"Pachchilaipalli":74,"Padaviya":75,"Palagala":76,"Pallepola":77,
    "Panvila":78,"Pasbagekorale":79,"Passara":80,"Pathadumbara":81,
    "Pathahewaheta":82,"Polgahawela":83,"Polpitigama":84,"Poojapitiya":85,
    "Poonakary":86,"Rambewa":87,"Rambukkana":88,"Ratnapura":89,"Rattota":90,
    "Rideegama":91,"Rideemaliyadda":92,"Sammanthurai":93,"Seruvila":94,
    "Soranathota":95,"Thalawa":96,"Thalawakele":97,"Thamankaduwa":98,
    "Thanamalwila":99,"Thenmaradchi (Chavakachcheri)":100,"Thirappane":101,
    "Udapalatha":102,"Ududumbara":103,"Udunuwara":104,"Ukuwela":105,
    "Vadamaradchchi East":106,"Vavuniya":107,"Vavuniya North":108,
    "Vavuniya South":109,"Vengalacheddikulam":110,"Verugal":111,"Walapane":112,
    "Warakapola":113,"Welikanda":114,"Welimada":115,"Welioya":116,
    "Wilgamuwa":117,"Yatawatta":118,"Yatinuwara":119,"Yatiyantota":120,
}

def compute_spi(series):
    """Exact match of temporal_split_pipeline.py compute_spi()."""
    valid = [v for v in series if v is not None]
    if not valid:
        return [None] * len(series)
    zeros = [v for v in valid if v == 0]
    non_zeros = [v for v in valid if v > 0]
    q = len(zeros) / len(valid)
    out = [None] * len(series)
    if non_zeros:
        try:
            a, loc, scale = stats.gamma.fit(non_zeros, floc=0)
            gamma_cdf = stats.gamma.cdf(np.array(valid), a, loc=loc, scale=scale)
            h_x = np.clip(q + (1 - q) * gamma_cdf, 0.0001, 0.9999)
            spi_vals = stats.norm.ppf(h_x)
            valid_iter = iter(np.round(spi_vals, 3))
            for i, v in enumerate(series):
                if v is not None:
                    out[i] = float(next(valid_iter))
        except Exception:
            pass
    return out


def main():
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    cur.execute('SELECT division_id, division_name FROM "Division" ORDER BY division_name')
    divisions = cur.fetchall()
    print(f"[compute] Processing {len(divisions)} divisions...")

    success, failed = 0, 0

    for division_id, name in divisions:
        try:
            cur.execute(
                'SELECT date, rain_sum FROM "RainfallData" WHERE division_id = %s ORDER BY date ASC',
                (division_id,)
            )
            rows = cur.fetchall()
            if not rows:
                print(f"  skip {name} — no data")
                continue

            dates = [r[0] for r in rows]
            rain_sums = [r[1] for r in rows]
            spi_values = compute_spi(rain_sums)
            division_encoded = DIVISION_ENCODING.get(name)

            records = []
            for i, (date, rain_sum) in enumerate(zip(dates, rain_sums)):
                month = date.month
                rain_lag_1      = rain_sums[i - 1] if i >= 1 else None
                rain_rolling_3d = sum(r or 0 for r in rain_sums[i-2:i+1]) if i >= 2 else None
                rain_rolling_7d = sum(r or 0 for r in rain_sums[i-6:i+1]) if i >= 6 else None
                month_sin       = math.sin(2 * math.pi * month / 12)
                month_cos       = math.cos(2 * math.pi * month / 12)
                spi             = spi_values[i]

                records.append((
                    division_id, date,
                    rain_lag_1, rain_rolling_3d, rain_rolling_7d,
                    month_sin, month_cos, spi, division_encoded
                ))

            execute_values(cur, """
                INSERT INTO computed_features
                    (division_id, date, rain_lag_1, rain_rolling_3d, rain_rolling_7d,
                     month_sin, month_cos, spi, division_encoded)
                VALUES %s
                ON CONFLICT (division_id, date) DO UPDATE SET
                    rain_lag_1      = EXCLUDED.rain_lag_1,
                    rain_rolling_3d = EXCLUDED.rain_rolling_3d,
                    rain_rolling_7d = EXCLUDED.rain_rolling_7d,
                    month_sin       = EXCLUDED.month_sin,
                    month_cos       = EXCLUDED.month_cos,
                    spi             = EXCLUDED.spi,
                    division_encoded= EXCLUDED.division_encoded
            """, records)
            conn.commit()

            print(f"  ✓ {name} — {len(rows)} days")
            success += 1
        except Exception as e:
            conn.rollback()
            print(f"  ✗ {name}: {e}")
            failed += 1

    cur.close()
    conn.close()
    print(f"\n[compute] Done. Success: {success}, Failed: {failed}")


if __name__ == "__main__":
    main()
