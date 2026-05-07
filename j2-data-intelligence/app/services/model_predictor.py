import os
import joblib
import numpy as np
import pandas as pd
from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import insert
from app.db.models import Predictions, Division

class SoftVotingEnsemble:
    def __init__(self, xgb_model, lgbm_model, n_classes=4):
        self.xgb_model  = xgb_model
        self.lgbm_model = lgbm_model
        self.n_classes  = n_classes
        
    def predict_proba(self, X):
        xgb_proba  = self.xgb_model.predict_proba(X)
        lgbm_proba = self.lgbm_model.predict_proba(X)
        avg = []
        # MultiOutputClassifier returns a list of arrays (one per horizon)
        # We only care about Day+1 (index 0) usually, but we handle the list.
        for xp, lp in zip(xgb_proba, lgbm_proba):
            n = max(xp.shape[1], lp.shape[1], self.n_classes)
            if xp.shape[1] < n: xp = np.hstack([xp, np.zeros((xp.shape[0], n-xp.shape[1]))])
            if lp.shape[1] < n: lp = np.hstack([lp, np.zeros((lp.shape[0], n-lp.shape[1]))])
            avg.append((xp + lp) / 2.0)
        return avg

MODELS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "models")
_models = {}

def load_models():
    if not _models:
        for hazard in ["Flood", "Landslide", "Drought"]:
            model_path = os.path.join(MODELS_DIR, f"{hazard}_ensemble.pkl")
            if os.path.exists(model_path):
                _models[hazard] = joblib.load(model_path)
            else:
                print(f"Warning: Model {model_path} not found.")

def sigmoid(x):
    return 1 / (1 + np.exp(-x))

def generate_predictions(df_features: pd.DataFrame, db: Session):
    load_models()
    
    if df_features.empty:
        return []

    FEATURES = [
        'rain_sum', 'temperature_2m_mean',
        'soil_moisture_7_to_28cm', 'soil_moisture_28_to_100cm', 'soil_moisture_100_to_255cm',
        'rain_lag_1', 'rain_rolling_3d', 'rain_rolling_7d',
        'month_sin', 'month_cos', 'spi', 'division_encoded'
    ]
    
    X = df_features[FEATURES]
    
    results = []
    
    # Predict for each hazard
    crisis_probs = {}
    for hazard in ["Flood", "Landslide", "Drought"]:
        if hazard in _models:
            model = _models[hazard]
            proba_list = model.predict_proba(X)
            proba_d1 = proba_list[0] # Day+1
            # Crisis = Severe (2) + Extreme (3)
            crisis_prob = proba_d1[:, 2] + proba_d1[:, 3]
            crisis_probs[hazard] = crisis_prob
        else:
            crisis_probs[hazard] = np.zeros(len(X))
            
    # Calculate Consideration Score
    # Fetch populations
    div_ids = df_features['division_id'].tolist()
    divisions = db.query(Division).filter(Division.division_id.in_(div_ids)).all()
    pop_map = {d.division_id: d.population or 1000 for d in divisions}
    
    max_pop = max(pop_map.values()) if pop_map else 1
    min_pop = min(pop_map.values()) if pop_map else 0
    if max_pop == min_pop: max_pop = min_pop + 1
    
    for i, row in df_features.iterrows():
        div_id = int(row['division_id'])
        date_val = row['date']
        
        p_flood = float(crisis_probs["Flood"][i])
        p_landslide = float(crisis_probs["Landslide"][i])
        p_drought = float(crisis_probs["Drought"][i])
        
        # Multi-hazard composite
        p_composite = 0.40 * p_flood + 0.35 * p_landslide + 0.25 * p_drought
        
        # Population factor
        pop = pop_map.get(div_id, 1000)
        pop_norm = (pop - min_pop) / (max_pop - min_pop)
        
        # Raw score
        s_raw = p_composite * pop_norm
        
        # Amplified Consideration Score
        s_consideration = float(sigmoid(8 * (s_raw - 0.5)))
        
        # Upsert Prediction
        stmt = insert(Predictions).values(
            division_id=div_id,
            date=date_val,
            flood_probability=p_flood,
            landslide_probability=p_landslide,
            drought_probability=p_drought,
            consideration_score=s_consideration
        )
        stmt = stmt.on_conflict_do_update(
            index_elements=['division_id', 'date'],
            set_=dict(
                flood_probability=stmt.excluded.flood_probability,
                landslide_probability=stmt.excluded.landslide_probability,
                drought_probability=stmt.excluded.drought_probability,
                consideration_score=stmt.excluded.consideration_score
            )
        )
        db.execute(stmt)
        
        results.append({
            "division_id": div_id,
            "date": date_val,
            "flood": p_flood,
            "landslide": p_landslide,
            "drought": p_drought,
            "consideration_score": s_consideration
        })
        
    db.commit()
    return results
