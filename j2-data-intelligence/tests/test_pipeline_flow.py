import sys
from unittest.mock import MagicMock

# Mock only missing web and db dependencies
for mod in [
    'fastapi', 'sqlalchemy', 'sqlalchemy.orm', 'sqlalchemy.dialects', 'sqlalchemy.dialects.postgresql',
    'apscheduler', 'apscheduler.schedulers', 'apscheduler.schedulers.background',
    'uvicorn', 'httpx', 'confluent_kafka'
]:
    sys.modules[mod] = MagicMock()

import asyncio
from datetime import date, timedelta
import os
from unittest.mock import patch

os.environ["DATABASE_URL"] = "sqlite:///:memory:"
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

mock_db = MagicMock()

with patch('app.main.SessionLocal', return_value=mock_db), \
     patch('app.db.database.engine'), \
     patch('app.db.database.Base.metadata.create_all'):
    
    from app.main import handle_data_fetched
    from app.services.event_manager import event_manager
    import app.services.model_predictor as model_predictor

model_predictor.Division.division_id = MagicMock()
model_predictor.Division.division_id.in_.return_value = MagicMock()

import pandas as pd
import numpy as np

# Create synthetic data for feature engineering
def mock_read_sql(*args, **kwargs):
    start_date = kwargs.get('params', {}).get('history_start', date.today() - timedelta(days=30))
    end_date = kwargs.get('params', {}).get('end_date', date.today() + timedelta(days=3))
    
    dates = pd.date_range(start=start_date, end=end_date)
    divisions = [1, 2] # 2 divisions
    
    data = []
    for div in divisions:
        for d in dates:
            data.append({
                'division_id': div,
                'division_name': f'Div_{div}',
                'date': d.date(),
                'rain_sum': np.random.uniform(0, 50),
                'temperature_2m_mean': np.random.uniform(20, 35),
                'soil_moisture_7_to_28cm': np.random.uniform(0.1, 0.4),
                'soil_moisture_28_to_100cm': np.random.uniform(0.1, 0.4),
                'soil_moisture_100_to_255cm': np.random.uniform(0.1, 0.4),
            })
            
    return pd.DataFrame(data)

class MockEnsemble:
    def predict_proba(self, X):
        # We simulate the 4-class output: Normal, Alert, Severe, Extreme
        prob = np.array([[0.1, 0.1, 0.4, 0.4]] * len(X))
        return [prob]

@patch('app.services.feature_engineering.pd.read_sql', side_effect=mock_read_sql)
@patch('app.services.model_predictor.joblib.load')
@patch('app.services.model_predictor.os.path.exists', return_value=True)
@patch('app.services.kafka_producer.Producer')
def run_test(mock_kafka, mock_exists, mock_load, mock_read):
    print("--- Starting Pipeline Test ---")
    
    # Setup mock models
    mock_load.return_value = MockEnsemble()
    
    # Setup mock Kafka
    mock_producer_instance = MagicMock()
    mock_kafka.return_value = mock_producer_instance
    
    # Register the listener (Normally happens on FastAPI startup)
    event_manager.subscribe("DATA_FETCHED", handle_data_fetched)
    
    d1 = MagicMock()
    d1.division_id = 1
    d1.population = 15000
    d2 = MagicMock()
    d2.division_id = 2
    d2.population = 20000
    
    mock_db.query.return_value.filter.return_value.all.return_value = [d1, d2]
    
    start_date = date.today()
    end_date = start_date + timedelta(days=3)
    
    print(f"[TEST] Emitting DATA_FETCHED event for {start_date} to {end_date}")
    
    # Run the event loop to execute the listener
    asyncio.run(event_manager.emit("DATA_FETCHED", start_date=start_date, end_date=end_date))
    
    print("\n--- Verifying Pipeline Execution ---")
    
    if mock_read.called:
        print("✅ Feature Engineering: Successfully queried database and computed features with Pandas.")
    else:
        print("❌ Feature Engineering: Failed to query database.")
        
    if mock_load.called:
        print("✅ Model Prediction: Successfully loaded models and executed SoftVotingEnsemble.")
    else:
        print("❌ Model Prediction: Failed to load models.")
        
    if mock_producer_instance.produce.called:
        print(f"✅ Kafka Producer: Successfully published {mock_producer_instance.produce.call_count} high-risk messages to Kafka.")

        first_call = mock_producer_instance.produce.call_args_list[0]
        topic = first_call.args[0]
        payload = first_call.kwargs.get("value")

        if topic == "j2.engine.risk-alerts":
            print("✅ Kafka Topic: Published to j2.engine.risk-alerts.")
        else:
            print(f"❌ Kafka Topic: Unexpected topic {topic}.")

        if payload:
            import json
            message = json.loads(payload)
            event_payload = message.get("payload", {})
            if event_payload.get("predictionCategory"):
                print(f"✅ Kafka Payload: Top category is {event_payload['predictionCategory']}.")
            else:
                print("❌ Kafka Payload: Missing predictionCategory.")

            if event_payload.get("district"):
                print(f"✅ Kafka Payload: District field set to {event_payload['district']}.")
            else:
                print("❌ Kafka Payload: Missing district field.")
        else:
            print("❌ Kafka Payload: No message body was sent.")
    else:
        print("❌ Kafka Producer: Failed to publish to Kafka. Check consideration score thresholds.")

if __name__ == "__main__":
    run_test()
