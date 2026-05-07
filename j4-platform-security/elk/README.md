# ELK Stack for Disaster Response System

This stack ships Docker container logs from the whole compose project into Elasticsearch and makes them searchable in Kibana.

## Flow

`container stdout/stderr -> Filebeat -> Logstash -> Elasticsearch -> Kibana`

## Services

- Elasticsearch: `http://localhost:9200`
- Logstash: `http://localhost:9600`
- Kibana: `http://localhost:5601`

## Bring it up

```bash
docker compose up -d elasticsearch elasticsearch-setup logstash kibana kibana-setup filebeat
```

If Elasticsearch refuses to start on your machine, set `vm.max_map_count=262144` on the Docker host/WSL2 environment and start the stack again.

## Automation included

- `elasticsearch-setup` creates:
	- ILM policy `drs-logs-ilm`
	- index template `drs-logs-template`
- `kibana-setup` creates:
	- data view `drs-logs-*`
	- dashboard `DRS Container Logs Overview`

## Retention policy (ILM)

Set retention days in the root `.env` file:

```env
ELK_LOG_RETENTION_DAYS=14
```

Logs older than this are automatically deleted by Elasticsearch ILM.

## Per-service parsing

Logstash includes service-aware parsing rules for:

- `j3-dms` JSON logs (`log.level`, `request_id`, `trace.id`)
- `kong` access logs (`http.*`, `client.ip`, status code)
- generic request/trace ID extraction for plaintext logs
