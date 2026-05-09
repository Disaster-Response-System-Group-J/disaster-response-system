# Quick Reference: Testing & Deployment

## Quick Start - Test the Alert Pipeline

### 1. Start Services (in separate terminals)

**Terminal 1: Event Bridge**
```bash
cd j3-system-interaction/dms
PORT=3002 node event-bridge.js
```

**Terminal 2: Send Test Alert**
```bash
cd j3-system-interaction/dms
node scripts/send-synthetic-risk-alert.js
```

**Terminal 3: Monitor Bridge**
```bash
tail -f j3-system-interaction/dms/bridge.log | grep -E "📡|✅|❌"
```

### 2. Verify Pipeline

**Check Kafka Message:**
```bash
docker exec disaster-kafka /opt/kafka/bin/kafka-console-consumer.sh \
  --bootstrap-server kafka:29092 \
  --topic j2.engine.risk-alerts \
  --from-beginning \
  --max-messages 1
```

**Check Bridge is Listening:**
```bash
ss -ltnp | grep 3002
# OR
curl -H "Upgrade: websocket" http://localhost:3002 2>&1 | head -5
```

---

## Dashboard Access

### Development:
```bash
cd j3-system-interaction/dms
npm run dev
# Open: http://localhost:3000
```

### Production:
- Dashboard URL: `https://your-domain:3000`
- WebSocket connection: Bridge at `port 3002` or as configured
- Alert is auto-displayed as toast in top-right corner

---

## Troubleshooting

### Problem: Bridge won't start

**Solution 1: Port in use**
```bash
# Find process on 3002
lsof -i :3002
# Kill it
kill -9 <PID>
# Retry
PORT=3002 node event-bridge.js
```

**Solution 2: Kafka not reachable**
```bash
# Check Kafka container
docker ps | grep kafka
# Or restart
docker-compose -f docker-compose.yml up -d kafka
```

### Problem: No alerts in dashboard

**Check:**
1. Bridge logs show "📡 [Kafka -> UI] Routing..."
2. Kafka has messages: `docker exec disaster-kafka /opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server kafka:29092 --topic j2.engine.risk-alerts --max-messages 1`
3. Frontend is open: `http://localhost:3000`
4. WebSocket is connected: Check browser Console → Network → WS

### Problem: Bridge reconnecting constantly

**Cause:** Kafka broker unstable

**Solution:**
```bash
# Restart Kafka
docker-compose down kafka
docker-compose up -d kafka
# Wait 10s
sleep 10
# Restart bridge
kill %1  # fg job
PORT=3002 node event-bridge.js
```

---

## Performance Monitoring

### Alerts Per Minute:
```bash
docker exec disaster-kafka /opt/kafka/bin/kafka-console-consumer.sh \
  --bootstrap-server kafka:29092 \
  --topic j2.engine.risk-alerts \
  --formatter kafka.tools.DefaultMessageFormatter \
  --property print.timestamp=true | wc -l
```

### Bridge Resource Usage:
```bash
ps aux | grep "node event-bridge" | grep -v grep | awk '{print $3, $4, $6}' # CPU, MEM, RSS
```

### Kafka Offset Lag:
```bash
docker exec disaster-kafka /opt/kafka/bin/kafka-consumer-groups.sh \
  --bootstrap-server kafka:29092 \
  --group j3-dashboard-group \
  --describe
```

---

## Alert Thresholds & Publish Logic

Alerts are published when:
- **Prediction Probability** > 0.65 AND
- **Consideration Score** > 0.60 AND
- **Resource Pressure** > 0.40

Tuning (edit j2-data-intelligence/app/services/kafka_producer.py):
```python
# Publish thresholds
MIN_PREDICTION_PROBABILITY = 0.65   # Increase to fewer false alarms
MIN_CONSIDERATION_SCORE = 0.60      # Increase AI confidence requirement
MIN_RESOURCE_PRESSURE = 0.40        # Increase to alert only when resources stretched
```

---

## Environment Variables Reference

### J2 (Data Intelligence)
```bash
export KAFKA_BROKER="localhost:29092,localhost:9092"
export KAFKA_TOPIC="j2.engine.risk-alerts"
```

### J3 (DMS Bridge)
```bash
export KAFKA_BROKER="localhost:29092,localhost:9092"
export PORT=3002                 # or BRIDGE_PORT=3002
export BRIDGE_HOST="0.0.0.0"     # Listen on all interfaces
```

---

## Docker Compose Reference

```bash
# Start all services
docker-compose up -d

# Check status
docker-compose ps

# Restart Kafka
docker-compose restart kafka

# View logs
docker-compose logs -f kafka

# Tear down
docker-compose down
```

---

## Kafka Topic Administration

### List Topics:
```bash
docker exec disaster-kafka /opt/kafka/bin/kafka-topics.sh \
  --bootstrap-server kafka:29092 \
  --list
```

### Describe Topic:
```bash
docker exec disaster-kafka /opt/kafka/bin/kafka-topics.sh \
  --bootstrap-server kafka:29092 \
  --topic j2.engine.risk-alerts \
  --describe
```

### Delete Topic (Warning: destructive):
```bash
docker exec disaster-kafka /opt/kafka/bin/kafka-topics.sh \
  --bootstrap-server kafka:29092 \
  --delete \
  --topic j2.engine.risk-alerts
```

### Reset Offset (replay messages from beginning):
```bash
docker exec disaster-kafka /opt/kafka/bin/kafka-consumer-groups.sh \
  --bootstrap-server kafka:29092 \
  --group j3-dashboard-group \
  --topic j2.engine.risk-alerts \
  --reset-offsets \
  --to-earliest \
  --execute
```

---

## Production Checklist

- [ ] Kafka cluster configured with replication factor ≥ 2
- [ ] Bridge runs with PM2/systemd for auto-restart
- [ ] Monitoring set up for bridge uptime
- [ ] Alert thresholds tuned for your region
- [ ] Database backups configured for predictions table
- [ ] SSL/TLS enabled for WebSocket connections
- [ ] CORS properly configured for dashboard domain
- [ ] Rate limiting in place to prevent alert spam
- [ ] Logging centralized (ELK stack or similar)
- [ ] Disaster recovery plan tested

---

**Quick Ref Version**: 1.0  
**Last Updated**: 2026-05-08
