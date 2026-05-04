# Consideration Score — Methodology & Calculation

**Group J2 — Disaster Response System : Model Training & Validation**

---

## Overview

The **Consideration Score** is a single continuous value in $[0, 1]$ that answers the operational question:

> _"How much attention does the emergency response system need to pay to this (Division, Date) pair right now?"_

It fuses three inputs:

1. **Multi-hazard crisis probability** — from the trained Flood, Drought, and Landslide ensemble models.
2. **At-risk population** — from `division_population_map.csv` (122 Sri Lankan Divisional Secretariats).
3. **Sigmoid amplification** — to ensure the output is discriminative and well-spread across $[0, 1]$.

A score of **0** means no consideration is needed. A score of **1** means the maximum possible level of emergency attention is warranted.

---

## Data Sources

| Input                        | Source                                       | Key Columns                                    |
| ---------------------------- | -------------------------------------------- | ---------------------------------------------- |
| Ensemble model probabilities | `*_ensemble.pkl` (flood, landslide, drought) | 4-class probability array per day per division |
| Division population          | `division_population_map.csv`                | `division`, `population`                       |

Population range in current dataset:

- **Minimum:** Pachchilaipalli — 16,157
- **Maximum:** Warakapola — 205,175

---

## Step-by-Step Calculation

### Step 1 — Crisis Probability per Hazard

For each hazard $h \in \{\text{Flood, Drought, Landslide}\}$ and forecast horizon $d \in \{1, 2, 3\}$, compute the cumulative probability of a **Severe or Extreme** outcome from the soft-voting ensemble:

$$P_h^{(d)} = P_{ensemble}^{(h)}(c=2 \mid \mathbf{x}, d) + P_{ensemble}^{(h)}(c=3 \mid \mathbf{x}, d)$$

The ensemble outputs a probability vector of shape `(4,)` for classes `[Normal=0, Moderate=1, Severe=2, Extreme=3]`. We sum the last two entries.

**Example — Flood model, Day+1:**

| Class    | Probability |
| -------- | ----------- |
| Normal   | 0.05        |
| Moderate | 0.20        |
| Severe   | 0.45        |
| Extreme  | 0.30        |

$$P_{\text{Flood}}^{(1)} = 0.45 + 0.30 = 0.75$$

---

### Step 2 — Multi-Hazard Composite Crisis Probability

Weight and sum the three hazard probabilities into a single composite value:

| Hazard    | Weight $w_h$ | Rationale                                                            |
| --------- | ------------ | -------------------------------------------------------------------- |
| Flood     | **0.40**     | Most frequent; large-scale displacement risk                         |
| Landslide | **0.35**     | High fatality-to-affected ratio in hill-country zones                |
| Drought   | **0.25**     | Slower onset; food security impact rather than immediate life threat |

$$P_{\text{composite}} = 0.40 \cdot P_{\text{Flood}}^{(1)} + 0.35 \cdot P_{\text{Landslide}}^{(1)} + 0.25 \cdot P_{\text{Drought}}^{(1)}$$

Since $\sum_h w_h = 1$ and each $P_h \in [0,1]$, the composite is also in $[0, 1]$.

> **Horizon note:** Day+1 is used for real-time alerting. Day+2 and Day+3 are tracked as trend indicators but do not contribute to today's score.

---

### Step 3 — Population Factor (Min-Max Normalised)

Raw population values are min-max normalised across all divisions so the factor is dimensionless and portable:

$$\text{pop\_norm}_{i} = \frac{\text{pop}_{i} - \text{pop}_{\min}}{\text{pop}_{\max} - \text{pop}_{\min}}$$

Using current `division_population_map.csv` values:

$$\text{pop\_norm}_{i} = \frac{\text{pop}_{i} - 16{,}157}{205{,}175 - 16{,}157} = \frac{\text{pop}_{i} - 16{,}157}{189{,}018}$$

**Example values:**

| Division        | Population | pop_norm |
| --------------- | ---------- | -------- |
| Pachchilaipalli | 16,157     | 0.000    |
| Karachchi       | 151,166    | 0.714    |
| Warakapola      | 205,175    | 1.000    |

---

### Step 4 — Raw Consideration Score

Multiply the composite crisis probability by the normalised population:

$$S_{\text{raw}} = P_{\text{composite}} \times \text{pop\_norm}$$

This raw score is in $[0, 1]$. It embodies the key principle:

> **High consideration requires BOTH high hazard probability AND large exposed population. Neither factor alone is sufficient.**

A 90 % flood probability in a nearly-empty division scores lower than a 50 % flood probability in the most populous division.

---

### Step 5 — Sigmoid Amplification

Most division-days are low-risk, causing $S_{\text{raw}}$ to cluster near zero. A **centred sigmoid** spreads the distribution and amplifies mid-range signals:

$$S_{\text{consideration}} = \frac{1}{1 + e^{-k \cdot (S_{\text{raw}} - 0.5)}}$$

Default steepness: **$k = 8$**. The $-0.5$ shift centres the sigmoid at the midpoint of $[0, 1]$.

**Sensitivity table (k = 8):**

| $S_{\text{raw}}$ | $S_{\text{consideration}}$ |
| ---------------- | -------------------------- |
| 0.05             | 0.055                      |
| 0.10             | 0.076                      |
| 0.25             | 0.182                      |
| 0.40             | 0.378                      |
| 0.50             | 0.500                      |
| 0.60             | 0.622                      |
| 0.75             | 0.818                      |
| 0.90             | 0.924                      |
| 0.95             | 0.945                      |

The output is strictly in $(0, 1)$ — it never reaches exactly 0 or 1, making it safe for downstream log or ratio computations.

> **If sigmoid is omitted**, set $S_{\text{consideration}} = S_{\text{raw}}$. This is simpler but produces a more compressed distribution.

---

## Complete Formula

$$\boxed{S_{\text{consideration}} = \sigma\!\left(k \cdot \left(\left[\sum_{h} w_h \cdot P_h^{(1)}\right] \times \text{pop\_norm} - 0.5\right)\right)}$$

Where:

- $\sigma(z) = \dfrac{1}{1+e^{-z}}$ is the standard logistic sigmoid
- $k = 8$ (steepness; tunable)
- $w_{\text{Flood}} = 0.40,\ w_{\text{Landslide}} = 0.35,\ w_{\text{Drought}} = 0.25$
- $\text{pop\_norm} \in [0, 1]$ from min-max normalisation over `division_population_map.csv`
- Output: $S_{\text{consideration}} \in (0, 1)$

---

## Python Implementation

```python
import numpy as np
import pandas as pd

# ── 1. Load and normalise population data ─────────────────────────────────────
pop_df = pd.read_csv(
    'division_population_map.csv'   # columns: division, population
)
pop_min = pop_df['population'].min()
pop_max = pop_df['population'].max()
pop_df['pop_norm'] = (pop_df['population'] - pop_min) / (pop_max - pop_min)
pop_lookup: dict[str, float] = pop_df.set_index('division')['pop_norm'].to_dict()

# ── 2. Hazard weights ──────────────────────────────────────────────────────────
WEIGHTS = {
    'flood':     0.40,
    'landslide': 0.35,
    'drought':   0.25,
}

# ── 3. Score function ──────────────────────────────────────────────────────────
def consideration_score(
    division: str,
    flood_probs:     np.ndarray,   # shape (4,): [P_Normal, P_Mod, P_Sev, P_Ext]
    landslide_probs: np.ndarray,
    drought_probs:   np.ndarray,
    k: float = 8.0,
) -> float:
    """
    Compute the Population-Weighted Consideration Score for a given division.

    Parameters
    ----------
    division        : Divisional Secretariat name (must match division_population_map.csv)
    flood_probs     : 4-element probability array from the flood ensemble (Day+1)
    landslide_probs : 4-element probability array from the landslide ensemble (Day+1)
    drought_probs   : 4-element probability array from the drought ensemble (Day+1)
    k               : sigmoid steepness (default 8)

    Returns
    -------
    float in (0, 1) — the Consideration Score for this (division, date) pair
    """
    # Step 1: Crisis probability (Severe + Extreme) per hazard
    p_flood      = float(flood_probs[2]      + flood_probs[3])
    p_landslide  = float(landslide_probs[2]  + landslide_probs[3])
    p_drought    = float(drought_probs[2]    + drought_probs[3])

    # Step 2: Weighted composite
    p_composite = (
        WEIGHTS['flood']     * p_flood     +
        WEIGHTS['landslide'] * p_landslide +
        WEIGHTS['drought']   * p_drought
    )

    # Step 3: Normalised population (0 if division not found)
    pop_norm = pop_lookup.get(division, 0.0)

    # Step 4: Raw score
    s_raw = p_composite * pop_norm

    # Step 5: Sigmoid amplification
    s_consideration = 1.0 / (1.0 + np.exp(-k * (s_raw - 0.5)))

    return s_consideration


# ── 4. Batch usage (vectorised) ────────────────────────────────────────────────
def batch_consideration_scores(
    df: pd.DataFrame,
    flood_prob_cols:     list[str],   # e.g. ['fl_p0','fl_p1','fl_p2','fl_p3']
    landslide_prob_cols: list[str],
    drought_prob_cols:   list[str],
    division_col:        str = 'division',
    k: float = 8.0,
) -> pd.Series:
    """
    Vectorised version for applying to a full prediction DataFrame.
    """
    p_flood     = df[flood_prob_cols[2]]     + df[flood_prob_cols[3]]
    p_landslide = df[landslide_prob_cols[2]] + df[landslide_prob_cols[3]]
    p_drought   = df[drought_prob_cols[2]]   + df[drought_prob_cols[3]]

    p_composite = (
        WEIGHTS['flood']     * p_flood     +
        WEIGHTS['landslide'] * p_landslide +
        WEIGHTS['drought']   * p_drought
    )

    pop_norm = df[division_col].map(pop_lookup).fillna(0.0)
    s_raw    = p_composite * pop_norm

    return 1.0 / (1.0 + np.exp(-k * (s_raw - 0.5)))
```

---

## Operational Thresholds

The Consideration Score is a **relative priority index**, not an absolute probability. Suggested thresholds for emergency response staging:

| Score Range | Operational Meaning        | Suggested Action                              |
| ----------- | -------------------------- | --------------------------------------------- |
| 0.00 – 0.20 | Negligible consideration   | No action; monitor routine feeds              |
| 0.20 – 0.40 | Low consideration          | Flag for awareness; no resource deployment    |
| 0.40 – 0.60 | Moderate consideration     | Pre-position resources; review locally        |
| 0.60 – 0.80 | High consideration         | Alert district coordinators; prepare response |
| 0.80 – 1.00 | **Critical consideration** | Immediate mobilisation; emergency response    |

Divisions are **ranked in descending order** of $S_{\text{consideration}}$ to generate the daily priority list for the dashboard.

---

## Design Rationale

| Design Choice                                     | Rationale                                                                                                 |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Continuous $[0,1]$ output                         | Enables smooth ranking; avoids binary threshold brittleness                                               |
| Crisis probability = Severe + Extreme only        | Moderate events are tracked by the models but do not drive emergency response triage                      |
| Min-max population normalisation                  | Keeps population dimensionless; automatically adapts as census data updates                               |
| Multiplicative combination of hazard & population | High hazard alone is insufficient; exposure (population) must also be high to justify large consideration |
| Sigmoid amplification                             | Prevents score compression near zero; improves dashboard discrimination for mid-range events              |
| Separable hazard weights $w_h$                    | Domain experts can adjust weights without retraining any model                                            |
| Day+1 as primary horizon                          | Most actionable for same-day resource allocation decisions                                                |

---

## Related Documents

- [`Methodology.md`](../data%20collection/Methodology.md) — Section 8: Population-Weighted Consideration Score (summary)
- [`Model_Training_Report.md`](./Model_Training_Report.md) — Ensemble model performance metrics
- [`division_population_map.csv`](./division_population_map.csv) — Population lookup table (121 divisions)
