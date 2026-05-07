import httpx
from datetime import date, timedelta
import pandas as pd
from sqlalchemy.orm import Session
from app.db.models import RainfallData, SoilMoisture, TemperatureData, Division
from sqlalchemy.dialects.postgresql import insert
from app.services.event_manager import event_manager

OPENMETEO_URL = "https://api.open-meteo.com/v1/forecast"

async def fetch_weather_for_division(division: Division, start_date: date, end_date: date, db: Session):
    params = {
        "latitude": division.latitude,
        "longitude": division.longitude,
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "daily": ["rain_sum", "temperature_2m_max", "temperature_2m_min"],
        "hourly": ["soil_moisture_0_to_1cm", "soil_moisture_1_to_3cm", "soil_moisture_3_to_9cm"],
        "timezone": "auto"
    }

    async with httpx.AsyncClient() as client:
        response = await client.get(OPENMETEO_URL, params=params, timeout=15.0)
        response.raise_for_status()
        data = response.json()

    # Process daily data
    if "daily" not in data or "time" not in data["daily"]:
        return
        
    daily_times = data["daily"]["time"]
    for i, date_str in enumerate(daily_times):
        fetch_date = date.fromisoformat(date_str)
        
        rain_sum = data["daily"]["rain_sum"][i] if data["daily"].get("rain_sum") and data["daily"]["rain_sum"][i] is not None else 0.0
        temp_max = data["daily"]["temperature_2m_max"][i] if data["daily"].get("temperature_2m_max") and data["daily"]["temperature_2m_max"][i] is not None else 0.0
        temp_min = data["daily"]["temperature_2m_min"][i] if data["daily"].get("temperature_2m_min") and data["daily"]["temperature_2m_min"][i] is not None else 0.0
        temp_mean = (temp_max + temp_min) / 2.0

        # Process hourly data for this specific day (24 readings per day)
        hourly = data.get("hourly", {})
        start_idx = i * 24
        end_idx = start_idx + 24
        
        def avg_layer(layer_key):
            vals = hourly.get(layer_key, [])[start_idx:end_idx]
            valid_vals = [v for v in vals if v is not None]
            return sum(valid_vals) / len(valid_vals) if valid_vals else 0.0

        moisture_0_1 = avg_layer("soil_moisture_0_to_1cm")
        moisture_1_3 = avg_layer("soil_moisture_1_to_3cm")
        moisture_3_9 = avg_layer("soil_moisture_3_to_9cm")

        # Upsert Rainfall
        stmt = insert(RainfallData).values(
            division_id=division.division_id,
            date=fetch_date,
            rain_sum=rain_sum
        )
        stmt = stmt.on_conflict_do_update(
            index_elements=['division_id', 'date'],
            set_=dict(rain_sum=stmt.excluded.rain_sum)
        )
        db.execute(stmt)

        # Upsert Temperature
        stmt = insert(TemperatureData).values(
            division_id=division.division_id,
            date=fetch_date,
            temperature=temp_mean
        )
        stmt = stmt.on_conflict_do_update(
            index_elements=['division_id', 'date'],
            set_=dict(temperature=stmt.excluded.temperature)
        )
        db.execute(stmt)

        # Upsert Soil Moisture
        stmt = insert(SoilMoisture).values(
            division_id=division.division_id,
            date=fetch_date,
            moisture_7_28cm=moisture_0_1,
            moisture_28_100cm=moisture_1_3,
            moisture_100_255cm=moisture_3_9
        )
        stmt = stmt.on_conflict_do_update(
            index_elements=['division_id', 'date'],
            set_=dict(
                moisture_7_28cm=stmt.excluded.moisture_7_28cm,
                moisture_28_100cm=stmt.excluded.moisture_28_100cm,
                moisture_100_255cm=stmt.excluded.moisture_100_255cm
            )
        )
        db.execute(stmt)
        
    db.commit()

async def fetch_weather_all_divisions(db: Session, target_date: date = None):
    if not target_date:
        target_date = date.today()
    
    start_date = target_date
    end_date = target_date + timedelta(days=3)
    
    divisions = db.query(Division).filter(Division.latitude != None).all()
    for div in divisions:
        try:
            await fetch_weather_for_division(div, start_date, end_date, db)
        except Exception as e:
            print(f"Error fetching for division {div.division_id}: {e}")
            db.rollback()
            
    # Emit event when all data is fetched
    await event_manager.emit("DATA_FETCHED", start_date=start_date, end_date=end_date)
