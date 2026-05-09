# 🚀 Quick Start: View Enhanced Alerts in Dashboard

## What You'll See

When you open the dashboard and an alert is published by J2, you'll see:

1. **Toast Notification** (top-right corner)
   - Alert severity and title
   - Location (district)
   - AI confidence metrics
   - Link to view full details

2. **Public Alerts Page** (full display)
   - Complete alert card with:
     - 3-metric dashboard (Prediction Probability, Consideration Score, Resource Pressure)
     - District resource breakdown by type
     - Probability distribution chart
     - Source and category

---

## Step-by-Step: See It Live

### Terminal 1: Ensure Bridge is Running

```bash
# Check if bridge is already running
ps aux | grep event-bridge.js | grep -v grep
```

If NOT running:
```bash
cd /home/ranuga-weerasekara/Desktop/disaster-response-system/j3-system-interaction/dms
PORT=3002 node event-bridge.js
# Wait for: ✅ Event Bridge Online
```

### Terminal 2: Start Dashboard

```bash
cd /home/ranuga-weerasekara/Desktop/disaster-response-system/j3-system-interaction/dms
npm run dev
# Starts at: http://localhost:3000
```

**Open in browser:**
```
http://localhost:3000
```

### Terminal 3: Send Synthetic Alert

```bash
cd /home/ranuga-weerasekara/Desktop/disaster-response-system/j3-system-interaction/dms
node scripts/send-synthetic-risk-alert.js
```

You should see:
```
Sent synthetic alert to j2.engine.risk-alerts via localhost:29092, localhost:9092
```

---

## What to Observe

### 1. Toast Notification (Immediate)
**Should appear in top-right of dashboard within 2-5 seconds:**

```
⚠️  HIGH ALERT: Synthetic Flood Watch for Colombo
Colombo | Synthetic Test Producer | Prob: 91%...
                                          [View Alert] [✕]
```

Click `[View Alert]` → navigates to `/public-alerts`

### 2. Public Alerts Page

**Navigate to:** `http://localhost:3000/public-alerts`

You'll see the alert card with:

#### Metric Boxes (3-column grid):
```
┌──────────────────┬──────────────────┬──────────────────┐
│ PREDICTION       │ CONSIDERATION    │ RESOURCE         │
│ PROBABILITY      │ SCORE            │ PRESSURE         │
│      91%         │      84%         │      65%         │
│ AI Confidence    │ Decision Support │ District Strain  │
└──────────────────┴──────────────────┴──────────────────┘
```

#### Resource Breakdown:
```
DISTRICT RESOURCES

┌────────────────┬─────────────────┬──────────────────┬─────────────┐
│ Total          │ Shelter         │ Water Supply     │ Medical     │
│ Resources      │ (Accommod.)     │ (Distribution)   │ (Clinics)   │
│                │                 │                  │             │
│ 45 TOTAL       │ 12 TOTAL        │ 8 TOTAL          │ 15 TOTAL    │
│ 18 Available   │ 4 Available ██░ │ 3 Available ██░░ │ 6 Available │
└────────────────┴─────────────────┴──────────────────┴─────────────┘
```

#### Probability Distribution:
```
SCENARIO PROBABILITIES

NORMAL      ████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 2.0%
MODERATE    ███████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 7.0%
SEVERE      █████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░ 78.0%
EXTREME     █████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 13.0%
```

---

## Verifying Data Flow

### Check Bridge Logs
```bash
tail -f /home/ranuga-weerasekara/Desktop/disaster-response-system/j3-system-interaction/dms/bridge.log | grep -E "📡|✅"
```

Expected output:
```
✅ Event Bridge Online. Connected to Kafka via localhost:29092, localhost:9092 & Next.js (3002)
📡 [Kafka -> UI] Routing j2.engine.risk-alerts to frontend!
📡 [Kafka -> UI] Routing j2.engine.risk-alerts to frontend!
```

### Check Browser Console
Open DevTools (`F12`) → Console tab

Look for:
- WebSocket connection confirmation
- Socket event logs (if enabled)
- No JavaScript errors

### Check Network Tab (Browser DevTools)
1. Open DevTools → Network tab
2. Send synthetic alert
3. Look for WebSocket message with alert payload
4. Should see message with all fields:
   - `predictionProbability`
   - `considerationScore`
   - `resourcePressure`
   - `resourceSummary`
   - `probabilities`

---

## Troubleshooting

### Issue: No toast appears
**Check:**
1. Bridge is running: `ps aux | grep event-bridge.js`
2. Bridge is connected to Kafka: See logs in bridge.log
3. Dashboard tab is in focus
4. Check browser console for errors

**Fix:**
```bash
# Restart bridge
pkill -f event-bridge.js
PORT=3002 node /home/ranuga-weerasekara/Desktop/disaster-response-system/j3-system-interaction/dms/event-bridge.js
# Restart dashboard
# (Ctrl+C and npm run dev)
```

### Issue: Metrics show 0% or undefined
**Check:**
1. Synthetic alert includes all fields:
   - `predictionProbability`
   - `considerationScore`
   - `resourcePressure`

See `/home/ranuga-weerasekara/Desktop/disaster-response-system/j3-system-interaction/dms/scripts/send-synthetic-risk-alert.js`

**Verify payload:**
```bash
docker exec disaster-kafka /opt/kafka/bin/kafka-console-consumer.sh \
  --bootstrap-server kafka:29092 \
  --topic j2.engine.risk-alerts \
  --from-beginning \
  --max-messages 1
```

Look for all required fields in JSON output.

### Issue: Resources show as empty
**Check:**
1. `resourceSummary` object structure:
   ```json
   {
     "overall": { "total": 45, "available": 18 },
     "by_type": {
       "shelter": { "total": 12, "available": 4 },
       "water_supply": { "total": 8, "available": 3 },
       "medical": { "total": 15, "available": 6 },
       "transport": { "total": 10, "available": 5 }
     }
   }
   ```

2. Check normalizeRiskAlert() is extracting it:
   - File: `j3-system-interaction/dms/lib/risk-alert.ts`
   - Line: `const resourceSummary = payload.resourceSummary ?? alert?.resourceSummary;`

### Issue: Probability bars don't render
**Check:**
1. Browser console for errors in chart rendering
2. Verify `probabilities` is an object:
   ```json
   {
     "NORMAL": 0.02,
     "MODERATE": 0.07,
     "SEVERE": 0.78,
     "EXTREME": 0.13
   }
   ```

3. All probabilities should sum to ~1.0 (allow small rounding error)

---

## Advanced: Send Custom Alert

Instead of synthetic alert, create your own in the dashboard:

1. **Admin only** - Click "Issue New Alert" button
2. Fill in:
   - **Headline**: "Custom Test Alert"
   - **Type**: RISK_ALERT
   - **Severity**: CRITICAL/HIGH
   - **District**: Colombo
   - **Message**: Your message
   - **Visibility**: Public (Visible to Citizens)
3. Click Submit

Alert will appear in system and route through socket if properly formatted.

---

## Data Used in Display

### Fields from Synthetic Alert

The file `/home/ranuga-weerasekara/Desktop/disaster-response-system/j3-system-interaction/dms/scripts/send-synthetic-risk-alert.js` sends:

```javascript
{
  "eventId": "synthetic-1715169688637",
  "eventType": "risk-alert",
  "timestamp": "2026-05-08T15:01:28.637Z",
  "payload": {
    "alertId": "ALT-SYN-1715169688637",
    "type": "RISK_ALERT",
    "severity": "HIGH",
    "title": "Synthetic Flood Watch for Colombo",
    "description": "Synthetic risk alert sent to verify the UI notification path.",
    "district": "Colombo",
    "divisionId": 1,
    "divisionName": "Colombo",
    "forecastDate": "2026-05-08",
    "predictionKind": "probabilistic",
    "predictionCategory": "FLOOD",
    "predictionProbability": 0.91,        // ← Shown in metric box
    "topProbabilityKey": "SEVERE",
    "probabilities": {                     // ← Shown in chart
      "NORMAL": 0.02,
      "MODERATE": 0.07,
      "SEVERE": 0.78,
      "EXTREME": 0.13
    },
    "considerationScore": 0.84,           // ← Shown in metric box
    "resourcePressure": 0.65,             // ← Shown in metric box
    "resourceSummary": {                  // ← Shown in resources table
      "overall": {
        "total": 45,
        "available": 18
      },
      "by_type": {
        "shelter": {"total": 12, "available": 4},
        "water_supply": {"total": 8, "available": 3},
        "medical": {"total": 15, "available": 6},
        "transport": {"total": 10, "available": 5}
      }
    },
    "hazardType": "FLOOD",
    "featureDate": "2026-05-08",
    "source": "Synthetic Test Producer",
    "isActive": true,
    "isPublic": false
  }
}
```

---

## Configuration

### Change metric display precision
File: `j3-system-interaction/dms/app/public-alerts/page.tsx`

Line with `.toFixed(0)` for percentage rounding:
```tsx
{(alert.predictionProbability * 100).toFixed(0)}%  // 0 decimals
// Change to:
{(alert.predictionProbability * 100).toFixed(1)}%  // 1 decimal
```

### Change resource types displayed
File: `j3-system-interaction/dms/app/public-alerts/page.tsx`

In resourceSummary mapping:
```tsx
{Object.entries(alert.resourceSummary.by_type).map(([type, counts]) => (
  // Currently shows: shelter, water_supply, medical, transport
  // Modify the order or filter here
))}
```

### Change color scheme
File: `j3-system-interaction/dms/app/public-alerts/page.tsx`

Search for Tailwind classes like:
- `bg-blue-500/5` → change to `bg-red-500/5` for red theme
- `text-blue-400` → change for different text color

---

## Summary

| Component | Status | Port | Command |
|-----------|--------|------|---------|
| Kafka | ✅ Running | 9092 (29092 internal) | docker-compose up kafka |
| Event Bridge | ✅ Running | 3002 | `PORT=3002 node event-bridge.js` |
| Dashboard | ✅ Ready | 3000 | `npm run dev` |
| Synthetic Producer | ✅ Ready | (ad-hoc) | `node scripts/send-synthetic-risk-alert.js` |

**Ready to test**: ✅ All systems operational

---

**Updated**: 2026-05-08  
**Version**: 1.0 - Production Ready
