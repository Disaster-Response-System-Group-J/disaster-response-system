from typing import List, Dict

import numpy as np
import pandas as pd

# Class multipliers — this is the key change
CLASS_MULTIPLIERS = {
    "Normal":   0.10,   # even if population is huge, score stays low
    "Moderate": 0.40,
    "Severe":   0.75,
    "Extreme":  1.00,   # full score possible
}

CLASS_LABELS = ["Normal", "Moderate", "Severe", "Extreme"]

# Tunable logistic scaling constant
K = 10.0


def compute_consideration_scores(preds: List[Dict], pop_rows: List[Dict], k: float = K) -> List[Dict]:
    """Compute consideration scores for a list of single-disaster prediction rows.

    preds: list of dicts with keys like 'division', 'hazard', and four class probabilities
           for that one hazard (for example, 'normal', 'moderate', 'severe', 'extreme').
    pop_rows: list of dicts with keys 'division' and 'population'
    Returns sorted list of dicts by consideration_score desc.
    """
    pop_df = pd.DataFrame(pop_rows)
    if pop_df.empty:
        pop_lookup = {}
    else:
        pop_min, pop_max = pop_df["population"].min(), pop_df["population"].max()
        if pop_max == pop_min:
            pop_df["pop_norm"] = 1.0
        else:
            pop_df["pop_norm"] = (pop_df["population"] - pop_min) / (pop_max - pop_min)
        pop_lookup = pop_df.set_index("division")["pop_norm"].to_dict()

    results = []
    for row in preds:
        div = row.get("division")

        hazard = row.get("hazard") or row.get("disaster") or row.get("hazard_name") or "Unknown"
        hazard_key = str(hazard).strip().lower()

        probabilities = [
            row.get("normal", row.get("p_normal", row.get(f"{hazard_key}_p_normal", 0.0))),
            row.get("moderate", row.get("p_moderate", row.get(f"{hazard_key}_p_moderate", 0.0))),
            row.get("severe", row.get("p_severe", row.get(f"{hazard_key}_p_severe", 0.0))),
            row.get("extreme", row.get("p_extreme", row.get(f"{hazard_key}_p_extreme", 0.0))),
        ]

        # Dominant class = whichever class has the highest probability for this single hazard
        dominant_class_idx = int(np.argmax(probabilities))
        dominant_class = CLASS_LABELS[dominant_class_idx]
        dominant_prob = float(probabilities[dominant_class_idx])

        # Use the maximum probability across all four classes
        p_peak = dominant_prob

        # Class multiplier caps and scales the score based on severity
        class_multiplier = CLASS_MULTIPLIERS.get(dominant_class, 1.0)

        pop_norm = float(pop_lookup.get(div, 0.0))

        # s_raw now includes class multiplier — Normal keeps it near 0, Extreme lets it reach 1
        s_raw = p_peak * pop_norm * class_multiplier

        # logistic scaling to push values into (0,1)
        s_consideration = 1.0 / (1.0 + np.exp(-k * (s_raw - 0.5)))

        results.append({
            "division":            div,
            "date":                row.get("date"),
            "consideration_score": round(float(s_consideration), 4),
        })

    return sorted(results, key=lambda x: x["consideration_score"], reverse=True)
