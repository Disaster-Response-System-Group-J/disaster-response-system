from locust import HttpUser, task, between
import json


class PrometheusUser(HttpUser):
    wait_time = between(1, 3)

    @task(3)
    def query_up(self):
        with self.client.get('/api/v1/query', params={'query': 'up'}, name='prometheus-query-up', catch_response=True) as response:
            if response.status_code != 200:
                response.failure('Prometheus query failed')

    @task(1)
    def query_alert_rules(self):
        with self.client.get('/api/v1/rules', name='prometheus-rules', catch_response=True) as response:
            if response.status_code != 200:
                response.failure('Prometheus rules endpoint failed')


class ElasticsearchUser(HttpUser):
    wait_time = between(0.5, 1.5)

    @task
    def send_bulk_logs(self):
        log_event = {
            '@timestamp': '2026-05-08T12:00:00Z',
            'service_name': 'j3-dms',
            'level': 'INFO',
            'message': 'load test event',
            'request_id': 'locust-request-id',
            'trace_id': 'locust-trace-id',
        }

        payload = '\n'.join([
            json.dumps({'index': {'_index': 'drs-load-test'}}),
            json.dumps(log_event),
            '',
        ])

        with self.client.post(
            '/_bulk',
            data=payload,
            headers={'Content-Type': 'application/x-ndjson'},
            name='elasticsearch-bulk',
            catch_response=True,
        ) as response:
            if response.status_code != 200:
                response.failure('Elasticsearch bulk request failed')
