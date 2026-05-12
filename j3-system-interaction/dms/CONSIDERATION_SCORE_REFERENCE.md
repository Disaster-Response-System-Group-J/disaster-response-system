# Consideration Score: Complete Mathematical Reference

## Formula Definition

The consideration score is calculated in `/scripts/test-full-pipeline.js`:

```javascript
function calculateConsiderationScore(floodProb, landslideProb, droughtProb, population) {
  // Step 1: Extract crisis probabilities (Severe + Extreme)
  const floodCrisisProb = floodProb.prob_severe + floodProb.prob_extreme;
  const landslideCrisisProb = landslideProb.prob_severe + landslideProb.prob_extreme;
  const droughtCrisisProb = droughtProb.prob_severe + droughtProb.prob_extreme;

  // Step 2: Normalize population (0-1 scale)
  const populationFactor = Math.min(population / 1000000, 1);

  // Step 3: Weight by hazard type
  const FLOOD_WEIGHT = 0.4;
  const LANDSLIDE_WEIGHT = 0.4;
  const DROUGHT_WEIGHT = 0.2;

  // Step 4: Calculate weighted crisis probability
  const rawScore = (floodCrisisProb * FLOOD_WEIGHT) + 
                   (landslideCrisisProb * LANDSLIDE_WEIGHT) + 
                   (droughtCrisisProb * DROUGHT_WEIGHT);

  // Step 5: Apply population factor
  return Math.min(rawScore * populationFactor, 1.0);
}
```

## Mathematical Formula

$$\text{Consideration Score} = w_f \cdot p_f + w_l \cdot p_l + w_d \cdot p_d \times \frac{\text{population}}{1,000,000}$$

Where:
- $p_f$ = Flood crisis probability = $P_f(\text{Severe}) + P_f(\text{Extreme})$
- $p_l$ = Landslide crisis probability = $P_l(\text{Severe}) + P_l(\text{Extreme})$
- $p_d$ = Drought crisis probability = $P_d(\text{Severe}) + P_d(\text{Extreme})$
- $w_f$ = Flood weight = 0.4
- $w_l$ = Landslide weight = 0.4
- $w_d$ = Drought weight = 0.2
- Result bounded: $[0, 1]$

## Worked Examples

### Example 1: Colombo (High Population, High Flood Risk)

**Division**: Colombo (ID: 1)
**Population**: 752,993

**Model Predictions**:
```
Flood:      P(Normal)=0.02, P(Moderate)=0.07, P(Severe)=0.35, P(Extreme)=0.56
Landslide:  P(Normal)=0.15, P(Moderate)=0.20, P(Severe)=0.40, P(Extreme)=0.25
Drought:    P(Normal)=0.70, P(Moderate)=0.20, P(Severe)=0.08, P(Extreme)=0.02
```

**Step-by-Step Calculation**:

1. **Extract Crisis Probabilities**:
   - Flood crisis: 0.35 + 0.56 = **0.91**
   - Landslide crisis: 0.40 + 0.25 = **0.65**
   - Drought crisis: 0.08 + 0.02 = **0.10**

2. **Population Factor**:
   - Pop = 752,993
   - Pop factor = 752,993 / 1,000,000 = **0.753**

3. **Weighted Crisis Probability**:
   - = (0.91 × 0.4) + (0.65 × 0.4) + (0.10 × 0.2)
   - = 0.364 + 0.260 + 0.020
   - = **0.644**

4. **Final Score**:
   - = 0.644 × 0.753
   - = **0.485**

**Result**: 🟡 **MEDIUM PRIORITY** (0.485)
- Interpretation: 48.5% of max alert threshold
- Action: Pre-position resources in Colombo

---

### Example 2: Colombo Small Division (High Risk, Small Population)

**Division**: Pachchilaipalli (ID: 48)
**Population**: 16,157 (much smaller)

**Same Model Predictions as Example 1** (same flood/landslide/drought probabilities):

1. **Crisis Probabilities**: Same as before
   - Flood: 0.91
   - Landslide: 0.65
   - Drought: 0.10

2. **Population Factor**:
   - Pop = 16,157
   - Pop factor = 16,157 / 1,000,000 = **0.016** (much lower!)

3. **Weighted Crisis Probability**: Same = **0.644**

4. **Final Score**:
   - = 0.644 × 0.016
   - = **0.010**

**Result**: 🟢 **LOW PRIORITY** (0.010)
- Interpretation: Same hazard probability, but small population
- Action: Monitor only (fewer people at risk)

---

### Example 3: Rural Division (Low Risk, Very Low Population)

**Division**: Morawewa (ID: 66)
**Population**: 34,435

**Conservative Model Predictions**:
```
Flood:      P(Normal)=0.80, P(Moderate)=0.12, P(Severe)=0.06, P(Extreme)=0.02
Landslide:  P(Normal)=0.85, P(Moderate)=0.10, P(Severe)=0.04, P(Extreme)=0.01
Drought:    P(Normal)=0.75, P(Moderate)=0.15, P(Severe)=0.08, P(Extreme)=0.02
```

**Calculation**:

1. **Crisis Probabilities**:
   - Flood: 0.06 + 0.02 = **0.08**
   - Landslide: 0.04 + 0.01 = **0.05**
   - Drought: 0.08 + 0.02 = **0.10**

2. **Population Factor**:
   - Pop = 34,435
   - Pop factor = **0.034**

3. **Weighted Crisis Probability**:
   - = (0.08 × 0.4) + (0.05 × 0.4) + (0.10 × 0.2)
   - = 0.032 + 0.020 + 0.020
   - = **0.072**

4. **Final Score**:
   - = 0.072 × 0.034
   - = **0.002**

**Result**: 🟢 **VERY LOW** (0.002)
- Interpretation: Low hazard probability + small population
- Action: Standard monitoring

---

### Example 4: Large Division with Extreme Probability

**Division**: Yatawatta (ID: 100)
**Population**: 106,023

**High-Risk Predictions**:
```
Flood:      P(Normal)=0.01, P(Moderate)=0.04, P(Severe)=0.45, P(Extreme)=0.50
Landslide:  P(Normal)=0.10, P(Moderate)=0.15, P(Severe)=0.50, P(Extreme)=0.25
Drought:    P(Normal)=0.70, P(Moderate)=0.20, P(Severe)=0.09, P(Extreme)=0.01
```

**Calculation**:

1. **Crisis Probabilities**:
   - Flood: 0.45 + 0.50 = **0.95** (extreme!)
   - Landslide: 0.50 + 0.25 = **0.75** (high)
   - Drought: 0.09 + 0.01 = **0.10** (low)

2. **Population Factor**:
   - Pop = 106,023
   - Pop factor = **0.106**

3. **Weighted Crisis Probability**:
   - = (0.95 × 0.4) + (0.75 × 0.4) + (0.10 × 0.2)
   - = 0.380 + 0.300 + 0.020
   - = **0.700**

4. **Final Score**:
   - = 0.700 × 0.106
   - = **0.074**

**Result**: 🟡 **MEDIUM** (0.074)
- Interpretation: Very high hazard probability, but small population
- Action: Pre-position resources (95% flood risk is significant)

---

## Threshold Interpretation

The alert system uses these thresholds:

| Score Range | Alert Level | Action | Resource Allocation |
|-------------|------------|--------|---------------------|
| 0.00 - 0.30 | 🟢 LOW | Monitor | Minimal |
| 0.30 - 0.70 | 🟡 MEDIUM | Pre-position | Standard |
| 0.70 - 1.00 | 🔴 HIGH/CRITICAL | Mobilize | Full deployment |

## Key Insights

### 1. Population Always Matters

Even with 95% flood probability (Example 4), a small population yields 0.074 score.
- **Why**: Resources are finite; we prioritize high-population areas
- **Effect**: Colombo gets priority over Morawewa even with same probability

### 2. Hazard Type Weights

Flood and Landslide weighted equally (0.4 each) > Drought (0.2):
- **Why**: Floods/landslides are acute emergencies
- **Drought**: Slower-moving, less emergency-like

### 3. Crisis Probability Definition

Only P(Severe) + P(Extreme) contribute:
- **Why**: P(Normal) + P(Moderate) don't trigger alerts
- **Effect**: 80% "Moderate" = 0, but 30% "Severe" counts fully

### 4. Score Ceiling at 1.0

```javascript
Math.min(..., 1.0)
```

- **Why**: Allow for composability (multiple divisions summed)
- **Effect**: Largest division + extreme prediction ≈ 1.0

## Real-World Scenario

**Monday 3 AM: Monsoon Season Prediction Run**

```
Division: Colombo (752,993 people)
Models predict: 89% flood, 72% landslide, 8% drought

Scores:
  Colombo:        0.482 🟡 MEDIUM
  Kandy:          0.354 🟡 MEDIUM
  Morawewa:       0.008 🟢 LOW
  Pachchilaipalli: 0.009 🟢 LOW

Alert System Behavior:
  ✓ Issues alerts for Colombo & Kandy
  ✓ Dispatches resources to both
  ✓ Skips smaller divisions
  ✓ Dashboard shows 2 active alerts
  ✓ Citizens in Colombo/Kandy receive SMS
```

## API Integration

When your test publishes an alert, the payload includes:

```json
{
  "alertId": "ALT-TEST-1-1715162947123",
  "divisionName": "Colombo",
  "predictionProbability": 0.91,
  "considerationScore": 0.482,
  "severity": "HIGH",
  "probabilities": {
    "NORMAL": 0.02,
    "MODERATE": 0.07,
    "SEVERE": 0.35,
    "EXTREME": 0.56
  }
}
```

The dashboard displays:
- **91%** under "PREDICTION PROBABILITY"
- **48.2%** under "CONSIDERATION SCORE"
- **HIGH** as severity badge
- Probability distribution chart showing the 4-class breakdown

---

## For Further Customization

To adjust score sensitivity, edit these constants in `test-full-pipeline.js`:

```javascript
// Make flood more important
const FLOOD_WEIGHT = 0.5;      // (was 0.4)
const LANDSLIDE_WEIGHT = 0.3;  // (was 0.4)
const DROUGHT_WEIGHT = 0.2;    // (same)

// Adjust population scaling
const populationFactor = Math.min(population / 500000, 1); // sensitize to smaller pops
```

Then rerun:
```bash
npm run test:pipeline
```
