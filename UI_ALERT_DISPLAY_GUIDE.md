# Enhanced Alert Display UI Guide

## What You'll See in the Dashboard

When a synthetic (or real) risk alert is published by J2 and flows through the event bridge, it now displays with complete prediction and resource context in the Public Alerts page.

---

## Alert Card Display Layout

### Visual Structure (as shown in the screenshot reference):

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                               │
│  [ICON]  Synthetic Flood Watch for Colombo                        [SEVERITY] │
│          📍 Colombo  🕐 2026-05-08 15:01:28                                   │
│                                                                               │
│  Synthetic risk alert sent to verify the UI notification path.               │
│                                                                               │
│  ┌──────────────────┬──────────────────┬──────────────────┐                 │
│  │ Prediction       │ Consideration    │ Resource         │                 │
│  │ Probability      │ Score            │ Pressure         │                 │
│  │                  │                  │                  │                 │
│  │     91%          │      84%         │      65%         │                 │
│  │ AI Confidence    │ Decision Support │ District Strain  │                 │
│  └──────────────────┴──────────────────┴──────────────────┘                 │
│                                                                               │
│  DISTRICT RESOURCES                                                           │
│  ┌────────────────┬─────────────────┬──────────────────┬────────────────┐   │
│  │ Total          │ Shelter         │ Water Supply     │ Medical        │   │
│  │ Resources      │ (Accommod.)     │ (Distribution)   │ (Clinics)      │   │
│  │ 45             │ 12 [██████░░]   │ 8 [███░░░░░░]    │ 15 [████░░░░]  │   │
│  │ 18 available   │ 4 of 12         │ 3 of 8           │ 6 of 15        │   │
│  └────────────────┴─────────────────┴──────────────────┴────────────────┘   │
│                                                                               │
│  SCENARIO PROBABILITIES                                                       │
│  ┌──────────┬────────────────────────────────────────────────────────────┐   │
│  │  NORMAL  │ ████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 2.0%   │   │
│  │ MODERATE │ ███████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 7.0%   │   │
│  │  SEVERE  │ ███████████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░ 78.0%  │   │
│  │ EXTREME  │ █████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 13.0%  │   │
│  └──────────┴────────────────────────────────────────────────────────────┘   │
│                                                                               │
│  Source: Synthetic Test Producer                          Category: FLOOD    │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Data Fields Displayed

### 1. **Header Section**
- **Alert Title**: "Synthetic Flood Watch for Colombo"
- **Icon**: Flood icon (wave symbol) for FLOOD hazards
- **Location**: District name (Colombo)
- **Timestamp**: ISO format (2026-05-08 15:01:28)
- **Severity Badge**: HIGH (orange), CRITICAL (red)

### 2. **Description**
Alert message body with details about the hazard

### 3. **Three Key Metrics (Grid Layout)**
These metrics help decision-makers determine urgency and readiness:

#### a) **Prediction Probability: 91%**
- What it means: AI model predicts 91% chance the hazard will occur
- Range: 0-100%
- Color: Blue theme
- Label: "AI Confidence"
- Why it matters: Higher = more certain the hazard will happen

#### b) **Consideration Score: 84%**
- What it means: AI confidence in the prediction itself
- Range: 0-100%
- Color: Cyan theme
- Label: "Decision Support"
- Why it matters: Used by J2 pipeline to decide whether to publish alert

#### c) **Resource Pressure: 65%**
- What it means: How stretched the district's resources are
- Range: 0-100%
  - 0% = All resources available
  - 100% = All resources in use
- Color: Orange theme
- Label: "District Strain"
- Why it matters: Tells responders if mutual aid or external help is needed

### 4. **District Resources Section**
Shows a breakdown of available resources by type:

```
+─────────────────┬──────────────────┬──────────────────┬────────────────+
| Total Resources | Shelter          | Water Supply     | Medical        |
| 45              | 12 total         | 8 total          | 15 total       |
| 18 available    | 4 available ███  | 3 available ██░  | 6 available ████
+─────────────────┴──────────────────┴──────────────────┴────────────────+
```

**What each row shows:**
- Resource type (Shelter, Water Supply, Medical, Transport, etc.)
- Total count for that district
- Available/operational count
- Visual progress bar showing availability ratio

**Why it matters:**
- Responders can see at a glance where resources are stretched
- 4 shelters available out of 12 means 8 are at capacity
- Helps with contingency planning and resource requests

### 5. **Scenario Probabilities Section**
Shows probability distribution across all possible outcomes:

```
NORMAL    ████░░░░░░░░░░░░░░  2.0%
MODERATE  ███████░░░░░░░░░░░░ 7.0%
SEVERE    █████████████████░░ 78.0%  ← Most likely scenario
EXTREME   █████████░░░░░░░░░░ 13.0%
```

**Color coding:**
- NORMAL → Blue
- MODERATE → Yellow
- SEVERE → Orange
- EXTREME → Red

**Why it matters:**
- Shows what the AI thinks will happen (78% chance of SEVERE flooding)
- Helps justify the alert level and response type
- Alternative scenarios help with contingency planning

### 6. **Footer**
- **Source**: "Synthetic Test Producer" or actual source system
- **Category**: FLOOD, LANDSLIDE, DROUGHT, etc.

---

## Real-World Example: Actual Alert Data

When J2 sends an alert for a real flood prediction in Colombo district:

```json
{
  "alertId": "ALT-2026-0508-001",
  "type": "RISK_ALERT",
  "severity": "CRITICAL",
  "title": "Level 3 Flood Warning — Kelani River Basin",
  "description": "Kelani River water levels exceeding danger mark. Colombo & Gampaha districts under evacuation orders.",
  "district": "Colombo",
  "predictionProbability": 0.87,
  "considerationScore": 0.92,
  "resourcePressure": 0.78,
  "topProbabilityKey": "SEVERE",
  "probabilities": {
    "NORMAL": 0.02,
    "MODERATE": 0.07,
    "SEVERE": 0.78,
    "EXTREME": 0.13
  },
  "resourceSummary": {
    "overall": { "total": 45, "available": 10 },
    "by_type": {
      "shelter": { "total": 12, "available": 2 },
      "water_supply": { "total": 8, "available": 1 },
      "medical": { "total": 15, "available": 4 },
      "transport": { "total": 10, "available": 3 }
    }
  },
  "source": "J2 Risk Engine",
  "isPublic": true,
  "isActive": true
}
```

### How This Displays in UI:

```
🚨 LEVEL 3 FLOOD WARNING — KELANI RIVER BASIN          [CRITICAL]
📍 Colombo  🕐 05/08/2026, 3:00 PM

Kelani River water levels exceeding danger mark. Colombo & Gampaha 
districts under evacuation orders.

┌──────────────────┬──────────────────┬──────────────────┐
│ Prediction       │ Consideration    │ Resource         │
│ Probability      │ Score            │ Pressure         │
│      87%         │      92%         │      78%         │
│ AI Confidence    │ Decision Support │ District Strain  │
└──────────────────┴──────────────────┴──────────────────┘

DISTRICT RESOURCES (Only 22% Available!)
┌────────────────┬─────────────────┬──────────────────┬────────────────┐
│ Total: 45      │ Shelter: 12     │ Water: 8         │ Medical: 15    │
│ Available: 10  │ Available: 2    │ Available: 1     │ Available: 4   │
│ (22% only)     │ (17% only)      │ (13% only)       │ (27%)          │
└────────────────┴─────────────────┴──────────────────┴────────────────┘

SCENARIO PROBABILITIES
NORMAL    ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 2.0%
MODERATE  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 7.0%
SEVERE    ███████████████████████░░░░░░░░░░░░░░░░ 78.0%
EXTREME   █████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 13.0%

Source: J2 Risk Engine                            Category: FLOOD
```

---

## User Actions on Alert Cards

When viewing an alert in the Public Alerts dashboard, users can:

1. **Read Alert Title** - Immediately understand the hazard and location
2. **Check Metrics** - See prediction confidence and resource availability
3. **Review Probabilities** - Understand what scenarios are most likely
4. **Check Resources** - Determine if calling for mutual aid is needed
5. **View Source** - Know where the alert came from
6. **Navigate to Details** - Click alert to expand or go to operational dashboard

---

## Technical Integration Points

### Where the Data Comes From:

```
J2 Prediction Pipeline
        ↓
  (Generates predictions with resourceSummary)
        ↓
Kafka Topic: j2.engine.risk-alerts
        ↓
  (Alert message with all fields)
        ↓
Event Bridge (Node.js)
        ↓
  (Forwards via WebSocket)
        ↓
normalizeRiskAlert()
        ↓
  (Extracts and validates fields)
        ↓
Public Alerts Page Component
        ↓
  (Renders enhanced alert card with all metrics)
```

### Data Flow:

1. **J2 produces alert**: Includes `resourcePressure`, `resourceSummary`, `predictionProbability`, `considerationScore`, `probabilities`
2. **Bridge forwards**: Passes event to connected WebSocket clients
3. **normalizeRiskAlert()**: Extracts and safely converts all fields
4. **Alert Type**: TypeScript Alert interface includes all new fields
5. **Render**: Public-alerts page displays all metrics in responsive grid layout

---

## Styling & Visual Hierarchy

### Color Scheme:
- **Prediction Probability**: Blue (#3b82f6) - "what's most likely to happen"
- **Consideration Score**: Cyan (#06b6d4) - "AI confidence in its own prediction"
- **Resource Pressure**: Orange (#ea580c) - "district strain level"
- **Probabilities**:
  - EXTREME: Red (#ef4444)
  - SEVERE: Orange (#f97316)
  - MODERATE: Yellow (#eab308)
  - NORMAL: Blue (#3b82f6)

### Responsiveness:
- **Mobile (≤640px)**: 2-column grid for metrics, stacked resources
- **Tablet (641-1024px)**: 3-column grid for metrics, 2-column resources
- **Desktop (>1024px)**: Full layout with 4-column resource breakdown

---

## Example Toast Notification

When an alert arrives while user is in the dashboard:

```
┌─────────────────────────────────────────────────────────┐
│ ⚠️  CRITICAL ALERT: Level 3 Flood Warning — Kelani River │
│ Colombo | J2 Risk Engine | Prob: 87% | Score: 92%     │
│                                     [View Alert] [✕]     │
└─────────────────────────────────────────────────────────┘
```

Toast appears for 8 seconds and includes action button to navigate to full alert details.

---

## Testing the Display

### How to See It Live:

1. **Bridge running**: `PORT=3002 node event-bridge.js` (already running)
2. **Dashboard open**: `npm run dev` → http://localhost:3000
3. **Send alert**: `node scripts/send-synthetic-risk-alert.js`
4. **Observe**:
   - Toast notification appears with alert summary
   - Navigate to /public-alerts to see full card with all metrics
   - Check bridge.log for "📡 [Kafka -> UI] Routing j2.engine.risk-alerts"

### Verification Checklist:

- [ ] Toast notification appears in top-right
- [ ] Toast shows probability and consideration scores
- [ ] Public Alerts page loads and displays alert card
- [ ] Three metric boxes show: Probability, Consideration, Pressure
- [ ] District Resources section shows breakdown by type
- [ ] Probability distribution bars display correctly
- [ ] Severity badge color matches alert severity
- [ ] Source and category displayed at bottom
- [ ] All numbers format correctly (0-100% scale)

---

**Deploy Status**: Ready for production  
**Last Updated**: 2026-05-08  
**Version**: 1.0 - Enhanced Display with Prediction & Resource Context
