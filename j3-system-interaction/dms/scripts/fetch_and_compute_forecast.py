"""
Fetch 3-day forecast from Open-Meteo, save raw data to forecast_weather_data,
then compute ML features and save to forecast_features.

Rolling features bridge historical data (from RainfallData) with the forecast.
SPI is computed using all available rain data (historical + forecast combined).
"""

import os, math, time, json
import urllib.request
import psycopg2
from psycopg2.extras import execute_values
import scipy.stats as stats
import numpy as np
from datetime import date, timedelta
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))
DATABASE_URL = os.environ["DATABASE_URL"]

FORECAST_DAYS = 3

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

# ─── Open-Meteo fetch ────────────────────────────────────────────────────────

def fetch_forecast(lat, lon, start_date, end_date):
    params = (
        f"latitude={lat}&longitude={lon}"
        f"&daily=rain_sum,apparent_temperature_max,apparent_temperature_min"
        f"&hourly=soil_moisture_0_to_1cm,soil_moisture_1_to_3cm,soil_moisture_3_to_9cm"
        f"&timezone=auto&start_date={start_date}&end_date={end_date}"
    )
    url = f"https://api.open-meteo.com/v1/forecast?{params}"
    with urllib.request.urlopen(url, timeout=15) as r:
        return json.loads(r.read())

def aggregate_soil_moisture(hourly, target_date_str):
    """Daily average of hourly soil moisture for a given date."""
    indices = [i for i, t in enumerate(hourly["time"]) if t.startswith(target_date_str)]
    if not indices:
        return None, None, None

    def avg(key):
        vals = [hourly[key][i] for i in indices if hourly[key][i] is not None]
        return sum(vals) / len(vals) if vals else None

    return (
        avg("soil_moisture_1_to_3cm"),   # proxy for 7-28cm
        (avg("soil_moisture_1_to_3cm") or 0 + avg("soil_moisture_3_to_9cm") or 0) / 2,
        avg("soil_moisture_3_to_9cm"),   # proxy for 100-255cm
    )

# ─── SPI (exact match to temporal_split_pipeline.py) ────────────────────────

def compute_spi(series):
    valid = [v for v in series if v is not None]
    if not valid:
        return [None] * len(series)
    zeros    = [v for v in valid if v == 0]
    non_zeros = [v for v in valid if v > 0]
    q = len(zeros) / len(valid)
    out = [None] * len(series)
    if non_zeros:
        try:
            a, loc, scale = stats.gamma.fit(non_zeros, floc=0)
            gamma_cdf = stats.gamma.cdf(np.array(valid), a, loc=loc, scale=scale)
            h_x = np.clip(q + (1 - q) * gamma_cdf, 0.0001, 0.9999)
            spi_vals = np.round(stats.norm.ppf(h_x), 3)
            it = iter(spi_vals)
            for i, v in enumerate(series):
                if v is not None:
                    out[i] = float(next(it))
        except Exception:
            pass
    return out

# ─── Main ────────────────────────────────────────────────────────────────────

def main():
    today      = date.today()
    start_date = today + timedelta(days=1)
    end_date   = today + timedelta(days=FORECAST_DAYS)
    start_str  = start_date.isoformat()
    end_str    = end_date.isoformat()

    print(f"[forecast] Fetching {FORECAST_DAYS} forecast days: {start_str} → {end_str}")

    conn = psycopg2.connect(DATABASE_URL)
    cur  = conn.cursor()

    cur.execute('SELECT division_id, division_name, latitude, longitude FROM "Division" WHERE latitude IS NOT NULL ORDER BY division_name')
    divisions = cur.fetchall()
    print(f"[forecast] Processing {len(divisions)} divisions...")

    success, failed = 0, 0

    for division_id, name, lat, lon in divisions:
        try:
            # 1. Fetch forecast from Open-Meteo
            data    = fetch_forecast(lat, lon, start_str, end_str)
            daily   = data["daily"]
            hourly  = data["hourly"]
            dates   = daily["time"]           # list of "YYYY-MM-DD"

            # 2. Build raw forecast records
            raw_records = []
            forecast_rain = []
            for i, d_str in enumerate(dates):
                rain   = daily["rain_sum"][i]
                t_max  = daily.get("apparent_temperature_max", [None]*len(dates))[i]
                t_min  = daily.get("apparent_temperature_min", [None]*len(dates))[i]
                temp   = (t_max + t_min) / 2 if t_max is not None and t_min is not None else (t_max or t_min)
                m7, m28, m100 = aggregate_soil_moisture(hourly, d_str)
                raw_records.append((division_id, d_str, rain, temp, m7, m28, m100))
                forecast_rain.append(rain)

            execute_values(cur, """
                INSERT INTO forecast_weather_data
                    (division_id, date, rain_sum, temperature,
                     moisture_7_28cm, moisture_28_100cm, moisture_100_255cm)
                VALUES %s
                ON CONFLICT (division_id, date) DO UPDATE SET
                    rain_sum           = EXCLUDED.rain_sum,
                    temperature        = EXCLUDED.temperature,
                    moisture_7_28cm    = EXCLUDED.moisture_7_28cm,
                    moisture_28_100cm  = EXCLUDED.moisture_28_100cm,
                    moisture_100_255cm = EXCLUDED.moisture_100_255cm,
                    fetched_at         = NOW()
            """, raw_records)

            # 3. Fetch last 7 historical rain values for rolling context
            cur.execute("""
                SELECT rain_sum FROM "RainfallData"
                WHERE division_id = %s ORDER BY date DESC LIMIT 7
            """, (division_id,))
            hist_rows = cur.fetchall()
            hist_rain = list(reversed([r[0] for r in hist_rows]))  # oldest first

            # 4. Combined rain series: [historical..., forecast+1, forecast+2, forecast+3]
            combined_rain = hist_rain + forecast_rain

            # 5. Compute SPI on full combined series
            all_spi = compute_spi(combined_rain)
            # SPI values for the forecast days are the last FORECAST_DAYS entries
            forecast_spi = all_spi[len(hist_rain):]

            division_encoded = DIVISION_ENCODING.get(name)

            # 6. Compute rolling features for each forecast day
            feature_records = []
            for i, d_str in enumerate(dates):
                hist_idx = len(hist_rain) + i       # index in combined_rain

                rain_lag_1      = combined_rain[hist_idx - 1] if hist_idx >= 1 else None
                rain_rolling_3d = sum(v or 0 for v in combined_rain[hist_idx-2:hist_idx+1]) if hist_idx >= 2 else None
                rain_rolling_7d = sum(v or 0 for v in combined_rain[hist_idx-6:hist_idx+1]) if hist_idx >= 6 else None

                d_obj   = date.fromisoformat(d_str)
                month   = d_obj.month
                feature_records.append((
                    division_id, d_str,
                    rain_lag_1, rain_rolling_3d, rain_rolling_7d,
                    math.sin(2 * math.pi * month / 12),
                    math.cos(2 * math.pi * month / 12),
                    forecast_spi[i],
                    division_encoded,
                ))

            execute_values(cur, """
                INSERT INTO forecast_features
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
            """, feature_records)

            conn.commit()
            print(f"  ✓ {name}")
            success += 1

        except Exception as e:
            conn.rollback()
            print(f"  ✗ {name}: {e}")
            failed += 1

        time.sleep(0.1)  # respect Open-Meteo rate limit

    cur.close()
    conn.close()
    print(f"\n[forecast] Done. Success: {success}, Failed: {failed}")
    print(f"[forecast] Rows: {success * FORECAST_DAYS} in forecast_weather_data, {success * FORECAST_DAYS} in forecast_features")


if __name__ == "__main__":
    main()
