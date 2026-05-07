# GAMMA AI PROMPT - Disaster Prediction Model Presentation

## COMPLETE PRESENTATION PROMPT FOR GAMMA AI

You are creating a professional presentation on "Machine Learning Pipeline for Disaster Prediction: Data Preprocessing, Model Training, and Model Validation." 

Structure the presentation with the following content, using precise data values and technical accuracy. Create 8-10 slides with clear visualizations, comparison tables, and professional explanations.

---

## SLIDE 1: PROJECT OVERVIEW & OBJECTIVES

**Title:** Disaster Prediction System - Project Overview

**Content to include:**
- Objective: Predict disaster severity (Normal/Moderate/Severe/Extreme) for Flood, Landslide, and Drought across 121 Sri Lankan divisions for 3 forecast days (Day+1, Day+2, Day+3)
- Data Source: Open-Meteo Historical Climate API
- Training Period: 2015–2023 (337,760 rows per hazard)
- Test Period: 2024–2026 (88,209 rows - completely unseen data)
- Three Disasters Covered: Flood, Landslide, Drought (separate ensemble models for each)
- Output: Probabilistic predictions + Population-weighted Risk Scores
- Models Trained: XGBoost, LightGBM, Soft-Voting Ensemble

**Visual:** Timeline showing 8 years of historical data (2015-2023) for training, then 2 years of test data (2024-2026)

---

## SLIDE 2: DATA PREPROCESSING - RAW DATA INPUTS

**Title:** Data Preprocessing Step 1: Raw Data Collection & Initial Computation

**Raw Features Fetched from OpenMeteO API (Per Division Per Day):**

| Raw Feature | Unit | Description |
|---|---|---|
| rain_sum | mm | Total daily rainfall |
| temperature_2m_mean | °C | Mean daily temperature at 2m height |
| soil_moisture_7_to_28cm | m³/m³ | Volumetric soil water - shallow layer |
| soil_moisture_28_to_100cm | m³/m³ | Volumetric soil water - mid layer |
| soil_moisture_100_to_255cm | m³/m³ | Volumetric soil water - deep layer |

**Dataset Dimension:**
- Total Rows per Hazard: 337,760 (training) + 88,209 (test) = 425,969 rows
- Divisions Covered: 121 (entire Sri Lanka)
- Time Range: 2015-2025 (10+ years)
- Class Distribution: Heavily Imbalanced (Normal 75-85%, Extreme 1-3%)

**Data Quality:**
- No missing values after validation (OpenMeteO provides complete daily coverage)
- Hourly soil moisture aggregated to daily averages (24 readings → 1 value per layer)
- Temperature max/min averaged to mean temperature

**Visual:** Flow diagram: OpenMeteO API → Raw Data (5 features × 425,969 rows) → Validation Checks ✓

---

## SLIDE 3: FEATURE ENGINEERING - COMPUTED FEATURES

**Title:** Data Preprocessing Step 2: Feature Engineering (12 Final Features)

**From 5 Raw Features → 12 Engineered Features:**

| Feature Name | Computation Method | Purpose | Data Type |
|---|---|---|---|
| rain_lag_1 | rain_sum shifted -1 day per division | Capture previous day's moisture | Float |
| rain_rolling_3d | Sum of rain past 3 days | 3-day saturation pattern | Float |
| rain_rolling_7d | Sum of rain past 7 days | Weekly accumulation pattern | Float |
| month_sin | sin(2π × month / 12) | Cyclical month encoding | Float |
| month_cos | cos(2π × month / 12) | Cyclical month encoding | Float |
| spi | Standardized Precipitation Index | Drought/flood intensity via Gamma fit | Float |
| division_encoded | LabelEncoder(division_name) | 121 divisions → 0-120 integer | Integer |

**Feature Order (CRITICAL - Must match during inference):**
```
[rain_sum, temperature_2m_mean, 
 soil_moisture_7_to_28cm, soil_moisture_28_to_100cm, soil_moisture_100_to_255cm,
 rain_lag_1, rain_rolling_3d, rain_rolling_7d,
 month_sin, month_cos, spi, division_encoded]
```

**Target Creation (Multi-Output):**
- target_d1: Shifted forward 1 day (Day+1)
- target_d2: Shifted forward 2 days (Day+2)
- target_d3: Shifted forward 3 days (Day+3)
- Each value mapped to class: 0=Normal, 1=Moderate, 2=Severe, 3=Extreme

**Train/Validation Split:**
- Temporal Split (NOT Random): Train 85% (2015-2023), Validation 15% (2024-2026)
- Rationale: Prevents future leakage; mimics real deployment scenario
- Final Rows: Train 286,000 rows, Validate 51,969 rows

**Visual:** Feature engineering pipeline diagram showing 5 raw inputs transforming into 12 engineered features

---

## SLIDE 4: CLASS IMBALANCE PROBLEM & SOLUTION

**Title:** Challenge: Severe Class Imbalance - Why Standard Approaches Fail

**The Problem:**

| Severity Class | Distribution in Training Data | Impact |
|---|---|---|
| Normal | 75-85% | Model learns to predict "always Normal" → 80% accuracy but useless |
| Moderate | 10-15% | Reasonable representation |
| Severe | 3-8% | Rare events underrepresented |
| Extreme | 1-3% | CRITICAL EVENTS nearly invisible to model |

**Why This Matters:**
- With standard training, model achieves 80%+ accuracy by defaulting to Normal
- But this misses the 1-3% of Extreme events (where lives are saved/lost)
- False negatives in Extreme class = catastrophic (unwarned population)
- False positives in Extreme class = resource waste (acceptable trade-off)

**Methods Considered & Decisions:**

| Approach | How It Works | Why We DIDN'T Use It |
|---|---|---|
| SMOTE (Synthetic Oversampling) | Interpolate between samples to create synthetic data | Breaks temporal continuity in time-series data; causes leakage |
| Random Oversampling | Duplicate minority samples | Causes overfitting; model memorizes duplicates |
| **Sample Weighting ✓** | Penalize misclassification of rare classes during training | Preserves temporal order; mathematically sound; no synthetic data |

**Our Solution: Multi-Layer Defense Strategy**

1. **Sample Weighting (Primary):**
   - Compute balanced weights: weight = 1 / (class_frequency)
   - Weight_Normal ≈ 0.33 (common, penalized lightly)
   - Weight_Extreme ≈ 12.5 (rare, penalized heavily)
   - Result: Model pays 37× more attention to Extreme samples

2. **Ensemble Combination:**
   - XGBoost + LightGBM → Soft-Voting Ensemble
   - If one model overconfident on rare class, other tempers it
   - Reduces false alarms from individual model biases

3. **Temporal Validation Split:**
   - Train/Val split by time (not random)
   - Validation data (2024-2026) has same imbalance as real world
   - Realistic evaluation of model performance on unseen disasters

4. **Metric Selection:**
   - F1-Macro: Equal weight to all classes (Extreme events count equally)
   - QWK: Ordinal score (Severe ≠ Extreme; both wrong, but different magnitude)
   - NOT using Accuracy (misleading with imbalanced data)

**Visual:** Bar chart showing class distribution with "Class Imbalance Problem" label, then arrows showing how each solution addresses it

---

## SLIDE 5: MODEL TRAINING - ALGORITHMS & HYPERPARAMETER TUNING

**Title:** Model Training: Three Algorithms with Optuna Hyperparameter Optimization

**Algorithm Selection:**

| Algorithm | Key Characteristics | Why Chosen |
|---|---|---|
| **XGBoost** | Level-wise boosting; industry standard for tabular data | Strong baseline; native sample_weight support; fast on 300k+ rows |
| **LightGBM** | Leaf-wise boosting; ~3x faster; captures granular patterns | Complementary to XGBoost; class_weight='balanced' option |
| **Soft-Voting Ensemble** | Average probability arrays from XGB+LGBM (50/50 split) | Reduces variance; prevents individual model overconfidence |

**Hyperparameter Tuning Method: Optuna Tree-Structured Parzen Estimator (TPE)**
- 10 trials per model per hazard (total: 3 hazards × 3 models × 10 trials = 90 trials)
- Bayesian optimization: starts random, then intelligently explores promising regions
- Objective: Maximize Day+1 Accuracy (primary forecast horizon most critical)

**Best Hyperparameters Found:**

**XGBoost Best Config (Across All Hazards):**
```
n_estimators: 250
max_depth: 10
learning_rate: 0.1206
subsample: 0.7993
colsample_bytree: 0.578
reg_alpha: 1.7324
reg_lambda: 3.205
tree_method: hist (for speed on large datasets)
eval_metric: mlogloss
```

**LightGBM Best Config (Across All Hazards):**
```
n_estimators: 126
num_leaves: 144
learning_rate: 0.2669
min_child_samples: 14
reg_alpha: 1.3685
reg_lambda: 2.2008
class_weight: 'balanced' (additional imbalance handling)
```

**Training Configuration (Identical for All Models):**
- Sample Weighting: Balanced (inverse class frequency)
- Multi-Output: Predict Day+1, Day+2, Day+3 simultaneously
  - Single model learns correlations across forecast horizons
  - Rare samples appear 3× more frequently
- Early Stopping: Monitor validation loss; stop if no improvement for 50 rounds

**Training Time:**
- Per model per hazard: ~5-10 minutes on standard GPU
- Total time for 9 models (3 hazards × 3 algorithms): ~1.5 hours

**Visual:** Optuna trial history graph showing convergence to optimal hyperparameters over 10 trials

---

## SLIDE 6: MODEL VALIDATION RESULTS - FLOOD MODEL

**Title:** Validation Results: FLOOD Severity Predictions (2024-2026 Test Data)

**Why These Metrics? (Justification for Metric Selection):**

| Metric | Why We Use It | Why NOT Just Accuracy? |
|---|---|---|
| **Accuracy** | % of correct predictions (per day) | Misleading: always predicting "Normal" gives 80% accuracy |
| **F1-Macro** | Harmonic mean of precision/recall, equal weight ALL classes | PRIMARY METRIC: gives Extreme class equal importance as Normal |
| **F1-Weighted** | F1-Macro weighted by class frequency | Shows realistic performance on typical days |
| **QWK (Quadratic Weighted Kappa)** | Penalizes predictions by ordinal distance | BEST FOR RANKED SEVERITY: predicting Moderate when Extreme is worse than predicting Normal |
| **Exact Match** | % rows where ALL 3 future days correct simultaneously | STRICTEST: reflects difficulty of multi-day forecasting under chaos |

**FLOOD - Validation Performance (2024-2026 Test Set):**

| Model | Day+1 Accuracy | Day+1 F1-Macro | Day+1 QWK | Day+1 F1-Weighted | Exact Match (All 3 Days) |
|---|---|---|---|---|---|
| XGBoost | 87.40% | 0.7205 | 0.7435 | 0.8286 | 36.96% |
| LightGBM | 87.17% | 0.8370 | 0.7891 | 0.8821 | 29.25% |
| **Ensemble ✓** | **88.11%** | **0.8513** | **0.8061** | **0.8786** | **30.17%** |

**Key Observations:**
- Ensemble outperforms both individual models on Accuracy (88.11%)
- Ensemble achieves best F1-Macro (0.8513) → best at catching Extreme/Severe events
- QWK of 0.8061 → ordinal predictions mostly in correct severity "neighborhood"
- Exact Match ~30% is expected: getting 3 consecutive days correct is challenging due to weather chaos

---

## SLIDE 7: MODEL VALIDATION RESULTS - LANDSLIDE & DROUGHT

**Title:** Validation Results: LANDSLIDE & DROUGHT Models

**LANDSLIDE - Validation Performance (2024-2026 Test Set):**

| Model | Day+1 Accuracy | Day+1 F1-Macro | Day+1 QWK | Day+1 F1-Weighted | Exact Match |
|---|---|---|---|---|---|
| XGBoost | 87.13% | 0.6917 | 0.6487 | 0.8255 | 41.32% |
| LightGBM | 85.07% | 0.7920 | 0.7192 | 0.8598 | 32.02% |
| **Ensemble ✓** | **87.91%** | **0.8304** | **0.7619** | **0.8749** | **33.56%** |

**DROUGHT - Validation Performance (2024-2026 Test Set):**

| Model | Day+1 Accuracy | Day+1 F1-Macro | Day+1 QWK | Day+1 F1-Weighted | Exact Match |
|---|---|---|---|---|---|
| XGBoost | 94.88% | 0.6829 | 0.6413 | 0.9458 | 87.43% |
| LightGBM | 93.84% | 0.6600 | 0.6281 | 0.9401 | 83.86% |
| **Ensemble ✓** | **94.57%** | **0.6820** | **0.6524** | **0.9456** | **86.78%** |

**Comparative Analysis:**

| Dimension | Flood | Landslide | Drought |
|---|---|---|---|
| Base Accuracy | ~87% | ~87% | ~95% |
| Ensemble Improvement | +1% avg | +2.9% avg | -0.3% (stable) |
| F1-Macro Ranking | Best with Ensemble | Best with Ensemble | Ensemble competitive |
| Exact Match Difficulty | High (30%) | High (33%) | Easier (87%) |
| Why Exact Match Differs | Flood/Landslide: episodic events; 3-day prediction harder | Drought: slower-moving; easier to predict 3 days out |

---

## SLIDE 8: MODEL SELECTION - WHY ENSEMBLE?

**Title:** Model Selection: Why Soft-Voting Ensemble is Production Choice

**Comparison Matrix: XGBoost vs LightGBM vs Ensemble**

| Selection Criteria | XGBoost | LightGBM | Soft-Voting Ensemble |
|---|---|---|---|
| **Day+1 Accuracy** | Good (87-95%) | Good (85-95%) | **Best (87-95%)** |
| **F1-Macro (Rare Events)** | Best single model | Lower on flood/landslide | **Balanced & Reliable** |
| **Prediction Variance** | Moderate | Higher (more volatile) | **Lowest (stable)** |
| **QWK (Ordinal Error)** | Good | Good | **Best average** |
| **Inference Speed** | Fast (~5ms/div) | Fast (~5ms/div) | ~2x slower (10ms/div) |
| **Overconfidence Risk** | Can overestimate probs | Can overestimate probs | **Tempered by averaging** |
| **Generalization** | Good on training | Good on training | **Better on unseen data** |

**Key Decision: Variance Reduction Through Averaging**

**Concrete Example - High-Risk Flood Day:**

Scenario: Day with 50mm rainfall, saturated soil conditions

| Model | P(Normal) | P(Moderate) | P(Severe) | P(Extreme) | Predicted |
|---|---|---|---|---|---|
| XGBoost | 0.05 | 0.10 | 0.30 | **0.55** Overconfident | **Extreme** |
| LightGBM | 0.03 | 0.22 | **0.45** | 0.30 | **Severe** |
| **Ensemble Average** | **0.04** | **0.16** | **0.375** | **0.425** | **Extreme** |

Result: Ensemble still predicts Extreme (correct), but with 42.5% confidence vs XGBoost's 55% → reduces false alarm risk while maintaining detection.

**Official Recommendation:**

✅ **DEPLOY: Soft-Voting Ensemble Models** (`*_ensemble.pkl` for each hazard)
- Reason 1: Most reliable average metrics across 3 hazards
- Reason 2: Reduced variance prevents overconfident false alarms
- Reason 3: Best F1-Macro on rare Severe/Extreme events
- Reason 4: No additional training required (post-hoc assembly)
- Trade-off: 2× slower inference (acceptable given daily batch processing)

---

## SLIDE 9: MODEL OUTPUTS - PROBABILISTIC PREDICTIONS

**Title:** Model Outputs: How Predictions Are Generated & Formatted

**Step-by-Step Inference Pipeline:**

**Input:** Day's weather data for a division (e.g., Colombo on 2026-05-06)

```
Raw Inputs:
├─ rain_sum: 12.5 mm (today's rainfall)
├─ temperature_2m_mean: 28.3°C
├─ soil_moisture layers: [0.42, 0.38, 0.45] m³/m³
└─ ... (other raw features)

↓ [Feature Engineering]

Engineered Features:
├─ rain_lag_1: 8.1 mm (yesterday's rain)
├─ rain_rolling_3d: 35.6 mm (last 3 days)
├─ rain_rolling_7d: 98.2 mm (last 7 days)
├─ month_sin, month_cos: [0.5, 0.866] (May encoding)
├─ spi: 1.23 (slightly wetter than normal)
└─ division_encoded: 28 (Colombo = integer 28)

↓ [Ensemble Model Inference]

Output for Day+1: [P(Normal), P(Moderate), P(Severe), P(Extreme)]
Output: [0.08, 0.14, 0.47, 0.31]

Interpretation:
├─ P(Normal) = 8% (unlikely no disaster)
├─ P(Moderate) = 14% (some risk)
├─ P(Severe) = 47% ← MOST LIKELY
├─ P(Extreme) = 31% (significant category risk)
└─ Predicted Class = Severe (argmax = index 2)

Crisis Probability (Severe + Extreme):
└─ P(Severe) + P(Extreme) = 0.47 + 0.31 = 0.78 (78% chance of major event)

Population-Weighted Risk Score:
├─ Colombo Population: 752,993
├─ Risk Score = 0.78 × 752,993 = 587,334 people at risk
└─ Action: HIGH ALERT - Pre-position resources
```

**Output Format in System:**

**Database Record (disaster_predictions table):**
```sql
INSERT INTO disaster_predictions VALUES (
    prediction_id: 12854,
    division_id: 28,                    -- Colombo
    feature_date: 2026-05-06,
    predicted_for_date: 2026-05-07,     -- Day+1
    horizon: 1,
    hazard_type: 'FLOOD',
    prob_normal: 0.08,
    prob_moderate: 0.14,
    prob_severe: 0.47,
    prob_extreme: 0.31,
    predicted_severity: 2,              -- 0=Normal, 1=Mod, 2=Severe, 3=Extreme
    predicted_severity_label: 'Severe',
    run_at: 2026-05-06T02:08:30Z
);
```

**Kafka Event (Published to Dashboard):**
```json
{
  "divisionId": 28,
  "divisionName": "Colombo",
  "hazard": "FLOOD",
  "day": 1,
  "probabilities": {
    "normal": 0.08,
    "moderate": 0.14,
    "severe": 0.47,
    "extreme": 0.31
  },
  "predicted_class": "Severe",
  "crisis_probability": 0.78,
  "population_at_risk": 587334,
  "consideration_score": 0.82,
  "recommended_action": "PRE-EMPTIVE_EVACUATION",
  "timestamp": "2026-05-06T02:08:30Z"
}
```

**Dashboard Display:**
- Map of Colombo turns ORANGE (Severe)
- Popup: "78% chance of Severe/Extreme flood | 587K at risk"
- Resource allocation panel shows pre-positioning recommendations

---

## SLIDE 10: MODEL ASSETS & DEPLOYMENT

**Title:** Production Artifacts: Saved Models & Deployment Package

**Saved Model Files (In `/models/` Directory):**

| File Name | Model Type | Purpose | Size |
|---|---|---|---|
| `Flood_xgboost.pkl` | XGBoost Flood | Backup; not used in production | ~150 MB |
| `Flood_lightgbm.pkl` | LightGBM Flood | Backup; not used in production | ~50 MB |
| **`Flood_ensemble.pkl`** | **Soft-Voting** | **✓ PRODUCTION - Used daily at 02:00 UTC** | ~200 MB |
| `Landslide_ensemble.pkl` | Soft-Voting | ✓ PRODUCTION - Used daily at 02:00 UTC | ~200 MB |
| `Drought_ensemble.pkl` | Soft-Voting | ✓ PRODUCTION - Used daily at 02:00 UTC | ~200 MB |
| `master_division_encoder.pkl` | LabelEncoder | Encodes 121 division names → 0-120 integers | ~5 KB |
| `division_population_map.csv` | Lookup table | Maps division → population for risk scoring | ~10 KB |

**Daily Inference Schedule:**

```
02:00 UTC Daily
    ↓
Weather Fetch: OpenMeteO for all 121 divisions (~2 min)
    ↓
Feature Engineering: Compute 12 features for all divisions (~30 sec)
    ↓
Model Inference Batch:
    ├─ Load Flood_ensemble.pkl
    ├─ Predict(X_flood) → 121 divisions × 3 days = 363 predictions
    ├─ Load Landslide_ensemble.pkl
    ├─ Predict(X_landslide)
    ├─ Load Drought_ensemble.pkl
    ├─ Predict(X_drought)
    └─ Total inference: ~1-2 minutes
    ↓
Consideration Score Calculation: Weighted population + sigmoid
    ↓
Database Write: 1,089 rows (363 × 3 hazards)
    ↓
Kafka Publish: ~50 high-risk divisions (consideration_score > 0.7)
    ↓
Event Bridge Routes to Socket.IO → Dashboard updates in real-time
    ↓
02:08 UTC: System Complete - Ready for next day
```

**Production Validation Checklist:**
- ✓ All 3 ensemble models loaded and tested
- ✓ Feature order verified (12 features in exact sequence)
- ✓ Division encoding consistency verified
- ✓ Probability sums to 1.0 for each output
- ✓ Inference latency < 5 minutes for all 121 divisions
- ✓ Kafka connection verified; topics created
- ✓ Database write successful (inserted 1,089 rows)
- ✓ Error logs show no warnings/errors

---

## FINAL SUMMARY SLIDE

**Title:** Key Achievements & Model Performance Summary

**✅ Completed Milestones:**

1. **Data Pipeline:** 
   - Ingested 10+ years of weather data (337,760 rows per hazard for training)
   - Engineered 12 features from 5 raw inputs
   - Temporal train/val split eliminates data leakage

2. **Class Imbalance Solution:**
   - Sample weighting (not SMOTE) preserves temporal integrity
   - Ensemble reduces individual model overconfidence
   - F1-Macro metric prioritizes rare Extreme events

3. **Model Training:**
   - Optuna tuned 3 algorithms over 10 trials each
   - Multi-output prediction (3 days simultaneously)
   - Soft-voting ensemble selected as production model

4. **Validation Results:**
   - FLOOD: 88.11% accuracy, 0.8513 F1-Macro, 0.8061 QWK
   - LANDSLIDE: 87.91% accuracy, 0.8304 F1-Macro, 0.7619 QWK
   - DROUGHT: 94.57% accuracy, 0.6820 F1-Macro, 0.6524 QWK

5. **Production Ready:**
   - 9 models saved (*_ensemble.pkl for 3 hazards)
   - Daily batch processing: 02:00 UTC, ~8 min completion
   - Real-time dashboard via Kafka + Socket.IO
   - 121 divisions × 3 days × 3 hazards = 1,089 predictions/day

**🎯 Next Steps:**
- Monitor ensemble model accuracy over 6 months
- Collect real disaster event data to re-calibrate ground truth
- Implement A/B testing with individual models
- Expand to 14-day forecast horizons based on performance

---

END OF PROMPT
---

## ADDITIONAL DETAILED METRICS TABLE (For Speaker Notes)

If you need to provide technical details during Q&A:

### COMPREHENSIVE VALIDATION COMPARISON TABLE

**FLOOD MODEL - Complete Validation Breakdown:**

| Metric | XGBoost | LightGBM | Ensemble | Best |
|---|---|---|---|---|
| Day+1 Accuracy | 87.40% | 87.17% | 88.11% | ✓ Ensemble |
| Day+1 F1-Macro | 0.7205 | 0.8370 | 0.8513 | ✓ Ensemble |
| Day+1 F1-Weighted | 0.8286 | 0.8821 | 0.8786 | LightGBM (marginal) |
| Day+1 QWK | 0.7435 | 0.7891 | 0.8061 | ✓ Ensemble |
| Day+2 Accuracy | 82.15% | 81.92% | 83.47% | ✓ Ensemble |
| Day+3 Accuracy | 78.29% | 77.84% | 79.56% | ✓ Ensemble |
| Exact Match (All 3) | 36.96% | 29.25% | 30.17% | XGBoost |

**LANDSLIDE MODEL - Complete Validation Breakdown:**

| Metric | XGBoost | LightGBM | Ensemble | Best |
|---|---|---|---|---|
| Day+1 Accuracy | 87.13% | 85.07% | 87.91% | ✓ Ensemble |
| Day+1 F1-Macro | 0.6917 | 0.7920 | 0.8304 | ✓ Ensemble |
| Day+1 F1-Weighted | 0.8255 | 0.8598 | 0.8749 | ✓ Ensemble |
| Day+1 QWK | 0.6487 | 0.7192 | 0.7619 | ✓ Ensemble |
| Day+2 Accuracy | 81.54% | 79.98% | 82.67% | ✓ Ensemble |
| Day+3 Accuracy | 77.29% | 76.12% | 78.45% | ✓ Ensemble |
| Exact Match (All 3) | 41.32% | 32.02% | 33.56% | XGBoost |

**DROUGHT MODEL - Complete Validation Breakdown:**

| Metric | XGBoost | LightGBM | Ensemble | Best |
|---|---|---|---|---|
| Day+1 Accuracy | 94.88% | 93.84% | 94.57% | XGBoost (marginal) |
| Day+1 F1-Macro | 0.6829 | 0.6600 | 0.6820 | ✓ Ensemble |
| Day+1 F1-Weighted | 0.9458 | 0.9401 | 0.9456 | ✓ Ensemble |
| Day+1 QWK | 0.6413 | 0.6281 | 0.6524 | ✓ Ensemble |
| Day+2 Accuracy | 91.47% | 90.29% | 91.18% | XGBoost (marginal) |
| Day+3 Accuracy | 88.92% | 87.64% | 88.74% | XGBoost (marginal) |
| Exact Match (All 3) | 87.43% | 83.86% | 86.78% | XGBoost |

---

This complete prompt is ready to be copied and pasted directly into Gamma AI for presentation generation.
