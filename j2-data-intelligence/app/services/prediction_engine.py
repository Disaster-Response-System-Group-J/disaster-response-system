"""
Risk Prediction Engine for J2

Generates disaster risk predictions (NORMAL, MODERATE, SEVERE, EXTREME) with probabilities (0.0-1.0)
using ensemble ML models (XGBoost + LightGBM with soft voting).
"""

import logging
import numpy as np
import pickle
import os
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.db.models import (
    Division, SensorReading, IoTDevice,
    DisasterPrediction, RiskAlert
)

logger = logging.getLogger(__name__)


class RiskPredictionEngine:
    """Generates disaster risk predictions for divisions"""
    
    # Model paths (relative to app root)
    MODEL_PATHS = {
        'FLOOD': 'app/models/Flood_ensemble.pkl',
        'LANDSLIDE': 'app/models/Landslide_ensemble.pkl',
        'DROUGHT': 'app/models/Drought_ensemble.pkl',
    }
    
    # Category thresholds for probability scores
    CATEGORY_THRESHOLDS = {
        'NORMAL': (0.0, 0.25),
        'MODERATE': (0.25, 0.50),
        'SEVERE': (0.50, 0.75),
        'EXTREME': (0.75, 1.0),
    }
    
    def __init__(self):
        """Initialize engine and load ML models"""
        self.models = {}
        self.load_models()
    
    def load_models(self):
        """Load pre-trained ensemble models"""
        for hazard_type, model_path in self.MODEL_PATHS.items():
            try:
                if os.path.exists(model_path):
                    with open(model_path, 'rb') as f:
                        self.models[hazard_type] = pickle.load(f)
                    logger.info(f"Loaded {hazard_type} model from {model_path}")
                else:
                    logger.warning(f"Model file not found: {model_path}")
                    # Use dummy model for demo purposes
                    self.models[hazard_type] = None
            except Exception as e:
                logger.error(f"Failed to load {hazard_type} model: {e}")
                self.models[hazard_type] = None
    
    def extract_features_flood(self, db: Session, division_id: int, hours_back: int = 24) -> dict:
        """
        Extract features for flood prediction from recent sensor readings
        
        Args:
            db: SQLAlchemy session
            division_id: Division to predict for
            hours_back: How many hours of history to use
        
        Returns:
            Dict of features suitable for model input
        """
        cutoff_time = datetime.utcnow() - timedelta(hours=hours_back)
        
        # Query recent FLOOD sensor readings
        readings = db.query(SensorReading).filter(
            SensorReading.division_id == division_id,
            SensorReading.sensor_type == "FLOOD",
            SensorReading.reading_timestamp >= cutoff_time
        ).order_by(SensorReading.reading_timestamp.desc()).limit(100).all()
        
        if not readings:
            logger.warning(f"No FLOOD readings for division {division_id}")
            return self._get_default_features()
        
        # Aggregate readings
        depths = [r.water_depth_cm for r in readings if r.water_depth_cm is not None]
        temps = [r.temperature_c for r in readings if r.temperature_c is not None]
        humidities = [r.humidity_pct for r in readings if r.humidity_pct is not None]
        
        features = {
            'depth_mean': float(np.mean(depths)) if depths else 0.0,
            'depth_max': float(np.max(depths)) if depths else 0.0,
            'depth_std': float(np.std(depths)) if depths else 0.0,
            'temp_mean': float(np.mean(temps)) if temps else 20.0,
            'humidity_mean': float(np.mean(humidities)) if humidities else 60.0,
            'reading_count': len(readings),
        }
        
        logger.debug(f"Extracted FLOOD features for division {division_id}: {features}")
        return features
    
    def extract_features_landslide(self, db: Session, division_id: int, hours_back: int = 24) -> dict:
        """Extract features for landslide prediction"""
        cutoff_time = datetime.utcnow() - timedelta(hours=hours_back)
        
        readings = db.query(SensorReading).filter(
            SensorReading.division_id == division_id,
            SensorReading.sensor_type == "LANDSLIDE",
            SensorReading.reading_timestamp >= cutoff_time
        ).order_by(SensorReading.reading_timestamp.desc()).limit(100).all()
        
        if not readings:
            logger.warning(f"No LANDSLIDE readings for division {division_id}")
            return self._get_default_features()
        
        # Extract metrics
        moistures = [r.soil_moisture for r in readings if r.soil_moisture is not None]
        accel_mags = [
            np.sqrt(r.accel_x**2 + r.accel_y**2 + r.accel_z**2)
            for r in readings
            if r.accel_x is not None and r.accel_y is not None and r.accel_z is not None
        ]
        
        features = {
            'soil_moisture_mean': float(np.mean(moistures)) if moistures else 2000.0,
            'soil_moisture_std': float(np.std(moistures)) if moistures else 500.0,
            'accel_magnitude_mean': float(np.mean(accel_mags)) if accel_mags else 9.8,
            'accel_magnitude_max': float(np.max(accel_mags)) if accel_mags else 10.0,
            'reading_count': len(readings),
        }
        
        logger.debug(f"Extracted LANDSLIDE features for division {division_id}: {features}")
        return features
    
    def extract_features_drought(self, db: Session, division_id: int, hours_back: int = 168) -> dict:
        """Extract features for drought prediction (typically longer time window)"""
        cutoff_time = datetime.utcnow() - timedelta(hours=hours_back)
        
        # For drought, we'd aggregate across all available readings
        readings = db.query(SensorReading).filter(
            SensorReading.division_id == division_id,
            SensorReading.reading_timestamp >= cutoff_time
        ).order_by(SensorReading.reading_timestamp.desc()).limit(200).all()
        
        if not readings:
            return self._get_default_features()
        
        temps = [r.temperature_c for r in readings if r.temperature_c is not None]
        humidities = [r.humidity_pct for r in readings if r.humidity_pct is not None]
        
        features = {
            'temp_mean': float(np.mean(temps)) if temps else 25.0,
            'temp_max': float(np.max(temps)) if temps else 30.0,
            'humidity_mean': float(np.mean(humidities)) if humidities else 70.0,
            'humidity_min': float(np.min(humidities)) if humidities else 40.0,
            'reading_count': len(readings),
        }
        
        logger.debug(f"Extracted DROUGHT features for division {division_id}: {features}")
        return features
    
    def _get_default_features(self) -> dict:
        """Return default/neutral feature set when no data available"""
        return {
            'value_1': 0.5,
            'value_2': 0.5,
        }
    
    def predict_probability(self, hazard_type: str, features: dict) -> float:
        """
        Generate raw probability (0-1) using ensemble model
        
        Args:
            hazard_type: FLOOD, LANDSLIDE, or DROUGHT
            features: Feature dict from extract_features_*
        
        Returns:
            Probability score 0.0-1.0
        """
        model = self.models.get(hazard_type)
        
        if model is None:
            logger.debug(f"No model available for {hazard_type}, using random probability for demo")
            # For demonstration without models, use deterministic but varied values
            return self._demo_probability(features, hazard_type)
        
        try:
            # Convert features dict to feature array expected by model
            # This assumes the model was trained with specific feature names
            feature_values = list(features.values())
            feature_array = np.array(feature_values).reshape(1, -1)
            
            # Get probability prediction from ensemble model
            # Assuming model has predict_proba method
            if hasattr(model, 'predict_proba'):
                proba = model.predict_proba(feature_array)[0]
                # Typically proba is [prob_negative, prob_positive]
                probability = float(proba[1])
            else:
                # Fallback for models without predict_proba
                probability = float(model.predict(feature_array)[0])
            
            probability = float(np.clip(probability, 0.0, 1.0))
            logger.debug(f"{hazard_type} probability: {probability:.3f}")
            return probability
        
        except Exception as e:
            logger.error(f"Error in predict_probability for {hazard_type}: {e}")
            return 0.5  # Default neutral probability
    
    def _demo_probability(self, features: dict, hazard_type: str) -> float:
        """Generate demo probability based on features (for when model not available)"""
        # Simple heuristic: if most features are > 0.5, higher probability
        values = [v for v in features.values() if isinstance(v, (int, float)) and 0 <= v <= 1]
        if values:
            if hazard_type == "FLOOD":
                # High depth increases flood probability
                depth_factor = features.get('depth_mean', 0.0) / 2.0  # Normalize if depth_mean is in cm
                return float(np.clip(0.3 + depth_factor * 0.5, 0.0, 1.0))
            elif hazard_type == "LANDSLIDE":
                # High acceleration increases landslide probability
                accel_factor = features.get('accel_magnitude_mean', 9.8) / 15.0
                return float(np.clip(0.2 + accel_factor * 0.6, 0.0, 1.0))
            else:  # DROUGHT
                # Low humidity increases drought probability
                humidity = features.get('humidity_mean', 60.0)
                return float(np.clip((100 - humidity) / 100 * 0.8, 0.0, 1.0))
        
        return 0.3  # Default low probability
    
    def probability_to_category(self, probability: float) -> str:
        """
        Convert continuous probability to category
        
        Args:
            probability: 0.0-1.0
        
        Returns:
            Category: NORMAL, MODERATE, SEVERE, or EXTREME
        """
        for category, (min_val, max_val) in self.CATEGORY_THRESHOLDS.items():
            if min_val <= probability < max_val:
                return category
        
        # Edge case: probability exactly 1.0
        return "EXTREME"
    
    def predict_for_division(self, db: Session, division: Division) -> list:
        """
        Generate predictions for all hazard types for a division
        
        Args:
            db: SQLAlchemy session
            division: Division to predict for
        
        Returns:
            List of DisasterPrediction objects (not yet persisted)
        """
        predictions = []
        all_probabilities = {}
        
        # Generate predictions for each hazard type
        for hazard_type in ['FLOOD', 'LANDSLIDE', 'DROUGHT']:
            # Extract features based on hazard type
            if hazard_type == 'FLOOD':
                features = self.extract_features_flood(db, division.id)
            elif hazard_type == 'LANDSLIDE':
                features = self.extract_features_landslide(db, division.id)
            else:  # DROUGHT
                features = self.extract_features_drought(db, division.id)
            
            # Generate probability
            probability = self.predict_probability(hazard_type, features)
            all_probabilities[hazard_type] = probability
            
            # Convert to category
            category = self.probability_to_category(probability)
            
            # Create prediction record
            prediction = DisasterPrediction(
                division_id=division.id,
                hazard_type=hazard_type,
                prediction_category=category,
                prediction_probability=probability,
                flood_probability=all_probabilities.get('FLOOD'),
                landslide_probability=all_probabilities.get('LANDSLIDE'),
                drought_probability=all_probabilities.get('DROUGHT'),
                consideration_score=probability,  # Could be population-weighted
                prediction_timestamp=datetime.utcnow(),
            )
            predictions.append(prediction)
        
        return predictions
    
    def predict_all_divisions(self, db: Session) -> list:
        """
        Generate predictions for all divisions
        
        Args:
            db: SQLAlchemy session
        
        Returns:
            List of DisasterPrediction objects (not yet persisted)
        """
        all_predictions = []
        
        divisions = db.query(Division).all()
        logger.info(f"Generating predictions for {len(divisions)} divisions")
        
        for division in divisions:
            try:
                predictions = self.predict_for_division(db, division)
                all_predictions.extend(predictions)
            except Exception as e:
                logger.error(f"Error predicting for division {division.id}: {e}")
        
        return all_predictions
