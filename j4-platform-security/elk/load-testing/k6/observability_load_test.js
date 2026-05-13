import http from 'k6/http';
import { check } from 'k6';

const PROMETHEUS_URL = __ENV.PROMETHEUS_URL || 'http://localhost:9090';
const ELASTICSEARCH_URL = __ENV.ELASTICSEARCH_URL || 'http://localhost:9200';

export const options = {
  scenarios: {
    prometheus_queries: {
      executor: 'constant-arrival-rate',
      rate: 20,
      timeUnit: '1s',
      duration: '5m',
      preAllocatedVUs: 20,
      maxVUs: 100,
      exec: 'prometheusQueries',
    },
    elasticsearch_bulk: {
      executor: 'constant-arrival-rate',
      rate: 50,
      timeUnit: '1s',
      duration: '5m',
      preAllocatedVUs: 25,
      maxVUs: 150,
      exec: 'elasticsearchBulk',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.02'],
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
  },
};

export function prometheusQueries() {
  const response = http.get(`${PROMETHEUS_URL}/api/v1/query?query=up`);

  check(response, {
    'Prometheus query succeeded': (r) => r.status === 200,
    'Prometheus returned a data block': (r) => r.json('data.result') !== undefined,
  });
}

export function elasticsearchBulk() {
  const timestamp = new Date().toISOString();
  const document = {
    '@timestamp': timestamp,
    service_name: 'j3-dms',
    level: 'INFO',
    message: `capacity test event at ${timestamp}`,
    request_id: `req-${__VU}-${__ITER}`,
    trace_id: `trace-${__VU}-${__ITER}`,
  };

  const payload = [
    JSON.stringify({ index: { _index: 'drs-load-test' } }),
    JSON.stringify(document),
    '',
  ].join('\n');

  const response = http.post(`${ELASTICSEARCH_URL}/_bulk`, payload, {
    headers: { 'Content-Type': 'application/x-ndjson' },
  });

  check(response, {
    'Elasticsearch bulk accepted': (r) => r.status === 200,
    'Bulk response has no errors': (r) => r.json('errors') === false,
  });
}
