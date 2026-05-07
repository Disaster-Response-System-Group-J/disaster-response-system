import {
  Counter,
  Gauge,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from "prom-client";

// Create a custom registry to avoid conflicts with the default
export const register = new Registry();

// Collect default Node.js metrics (memory, CPU, event loop lag, etc.)
collectDefaultMetrics({ register });

// HTTP Request Metrics
export const httpRequestCounter = new Counter({
  name: "http_requests_total",
  help: "Total HTTP requests",
  labelNames: ["method", "path", "status"],
  registers: [register],
});

export const httpRequestDuration = new Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "path", "status"],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register],
});

// Application-specific metrics
export const activeIncidentsGauge = new Gauge({
  name: "active_incidents_total",
  help: "Total number of active incidents",
  registers: [register],
});

export const alertsIssuedCounter = new Counter({
  name: "alerts_issued_total",
  help: "Total alerts issued",
  labelNames: ["severity"],
  registers: [register],
});

export const apiCallsCounter = new Counter({
  name: "api_calls_total",
  help: "Total API calls by endpoint",
  labelNames: ["endpoint", "status"],
  registers: [register],
});

export const processingTimeHistogram = new Histogram({
  name: "processing_time_seconds",
  help: "Processing time for operations in seconds",
  labelNames: ["operation"],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
  registers: [register],
});

export const eventsProcessedCounter = new Counter({
  name: "events_processed_total",
  help: "Total events processed from Kafka",
  labelNames: ["event_type", "status"],
  registers: [register],
});

// Database connection metrics
export const dbConnectionsGauge = new Gauge({
  name: "db_connections_active",
  help: "Active database connections",
  registers: [register],
});

export const dbQueryDuration = new Histogram({
  name: "db_query_duration_seconds",
  help: "Database query duration in seconds",
  labelNames: ["operation"],
  buckets: [0.001, 0.01, 0.05, 0.1, 0.5, 1],
  registers: [register],
});
