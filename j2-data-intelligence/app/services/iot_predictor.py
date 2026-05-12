import os
import logging
import joblib

logger = logging.getLogger(__name__)

MODELS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "models")

_flood_model = None
_flood_encoder = None
_landslide_model = None
_landslide_encoder = None

# Maps label (case-insensitive) → (severity_index, prob dict)
_LABEL_TO_SEVERITY = {
    "normal":   (0, {"normal": 1.0, "moderate": 0.0, "severe": 0.0, "extreme": 0.0}),
    "moderate": (1, {"normal": 0.0, "moderate": 1.0, "severe": 0.0, "extreme": 0.0}),
    "severe":   (2, {"normal": 0.0, "moderate": 0.0, "severe": 1.0, "extreme": 0.0}),
    "extreme":  (3, {"normal": 0.0, "moderate": 0.0, "severe": 0.0, "extreme": 1.0}),
}


def _load_models():
    global _flood_model, _flood_encoder, _landslide_model, _landslide_encoder
    if _flood_model is not None:
        return

    p = os.path.join(MODELS_DIR, "flood_ensemble_model.pkl")
    if os.path.exists(p):
        _flood_model = joblib.load(p)
        logger.info("Loaded flood_ensemble_model.pkl")
    else:
        logger.error(f"Model file not found: {p}")

    p = os.path.join(MODELS_DIR, "flood_label_encoder.pkl")
    if os.path.exists(p):
        _flood_encoder = joblib.load(p)
        logger.info("Loaded flood_label_encoder.pkl")
    else:
        logger.error(f"Model file not found: {p}")

    p = os.path.join(MODELS_DIR, "landslide_ensemble_model.pkl")
    if os.path.exists(p):
        _landslide_model = joblib.load(p)
        logger.info("Loaded landslide_ensemble_model.pkl")
    else:
        logger.error(f"Model file not found: {p}")

    p = os.path.join(MODELS_DIR, "landslide_label_encoder.pkl")
    if os.path.exists(p):
        _landslide_encoder = joblib.load(p)
        logger.info("Loaded landslide_label_encoder.pkl")
    else:
        logger.error(f"Model file not found: {p}")


def predict_flood(temp: float, hum: float, depth_prev: float, depth: float) -> str:
    """
    Predict flood severity using the ensemble model.

    Features (in order): temp, hum, depth_prev, depth
    Returns one of: Normal, Moderate, Severe, Extreme
    """
    _load_models()
    if _flood_model is None or _flood_encoder is None:
        raise RuntimeError("Flood model or encoder not loaded")

    features = [[float(temp), float(hum), float(depth_prev), float(depth)]]
    encoded = _flood_model.predict(features)
    return str(_flood_encoder.inverse_transform(encoded)[0])


def predict_landslide(
    temp: float, hum: float, moist: float,
    ax: float, ay: float, az: float,
    gx: float, gy: float, gz: float,
) -> str:
    """
    Predict landslide severity using the ensemble model.

    Features (in order): temp, hum, moist, ax, ay, az, gx, gy, gz
    Returns one of: Normal, Moderate, Severe, Extreme
    """
    _load_models()
    if _landslide_model is None or _landslide_encoder is None:
        raise RuntimeError("Landslide model or encoder not loaded")

    features = [[float(temp), float(hum), float(moist),
                 float(ax), float(ay), float(az),
                 float(gx), float(gy), float(gz)]]
    encoded = _landslide_model.predict(features)
    return str(_landslide_encoder.inverse_transform(encoded)[0])


def label_to_probabilities(label: str) -> dict:
    """Convert a predicted label string to a probability dict for DisasterPrediction storage."""
    key = label.lower()
    entry = _LABEL_TO_SEVERITY.get(key)
    if entry is None:
        logger.warning(f"Unknown label '{label}', defaulting to Normal")
        entry = _LABEL_TO_SEVERITY["normal"]
    _, probs = entry
    return probs


def label_to_severity_index(label: str) -> int:
    key = label.lower()
    entry = _LABEL_TO_SEVERITY.get(key)
    return entry[0] if entry else 0
