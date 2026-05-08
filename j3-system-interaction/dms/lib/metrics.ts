import {
  Counter,
  Gauge,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from "prom-client";

interface GlobalWithMetrics {
  __prom_registry?: Registry;
  __prom_metrics_initialized?: boolean;
  __prom_metrics_httpRequestCounter?: Counter;
  __prom_metrics_httpRequestDuration?: Histogram;
  __prom_metrics_activeIncidentsGauge?: Gauge;
  __prom_metrics_alertsIssuedCounter?: Counter;
  __prom_metrics_apiCallsCounter?: Counter;
  __prom_metrics_processingTimeHistogram?: Histogram;
  __prom_metrics_eventsProcessedCounter?: Counter;
  __prom_metrics_dbConnectionsGauge?: Gauge;
  __prom_metrics_dbQueryDuration?: Histogram;
}

// Use a global guard so metrics are not registered multiple times across hot reloads
const g = globalThis as typeof globalThis & GlobalWithMetrics;
if (!g.__prom_registry) {
  g.__prom_registry = new Registry();
}
export const register: Registry = g.__prom_registry;

if (!g.__prom_metrics_initialized) {
  collectDefaultMetrics({ register });

  // HTTP Request Metrics
  g.__prom_metrics_httpRequestCounter = new Counter({
    name: "http_requests_total",
    help: "Total HTTP requests",
    labelNames: ["method", "path", "status"],
    registers: [register],
  });

  g.__prom_metrics_httpRequestDuration = new Histogram({
    name: "http_request_duration_seconds",
    help: "HTTP request duration in seconds",
    labelNames: ["method", "path", "status"],
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
    registers: [register],
  });

  // Application-specific metrics
  g.__prom_metrics_activeIncidentsGauge = new Gauge({
    name: "active_incidents_total",
    help: "Total number of active incidents",
    registers: [register],
  });

  g.__prom_metrics_alertsIssuedCounter = new Counter({
    name: "alerts_issued_total",
    help: "Total alerts issued",
    labelNames: ["severity"],
    registers: [register],
  });

  g.__prom_metrics_apiCallsCounter = new Counter({
    name: "api_calls_total",
    help: "Total API calls by endpoint",
    labelNames: ["endpoint", "status"],
    registers: [register],
  });

  g.__prom_metrics_processingTimeHistogram = new Histogram({
    name: "processing_time_seconds",
    help: "Processing time for operations in seconds",
    labelNames: ["operation"],
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
    registers: [register],
  });

  g.__prom_metrics_eventsProcessedCounter = new Counter({
    name: "events_processed_total",
    help: "Total events processed from Kafka",
    labelNames: ["event_type", "status"],
    registers: [register],
  });

  // Database connection metrics
  g.__prom_metrics_dbConnectionsGauge = new Gauge({
    name: "db_connections_active",
    help: "Active database connections",
    registers: [register],
  });

  g.__prom_metrics_dbQueryDuration = new Histogram({
    name: "db_query_duration_seconds",
    help: "Database query duration in seconds",
    labelNames: ["operation"],
    buckets: [0.001, 0.01, 0.05, 0.1, 0.5, 1],
    registers: [register],
  });

  g.__prom_metrics_initialized = true;
}

// Export metrics from the global store so imports are idempotent
export const httpRequestCounter: Counter = g.__prom_metrics_httpRequestCounter;
export const httpRequestDuration: Histogram = g.__prom_metrics_httpRequestDuration;
export const activeIncidentsGauge: Gauge = g.__prom_metrics_activeIncidentsGauge;
export const alertsIssuedCounter: Counter = g.__prom_metrics_alertsIssuedCounter;
export const apiCallsCounter: Counter = g.__prom_metrics_apiCallsCounter;
export const processingTimeHistogram: Histogram = g.__prom_metrics_processingTimeHistogram;
export const eventsProcessedCounter: Counter = g.__prom_metrics_eventsProcessedCounter;
export const dbConnectionsGauge: Gauge = g.__prom_metrics_dbConnectionsGauge;
export const dbQueryDuration: Histogram = g.__prom_metrics_dbQueryDuration;
