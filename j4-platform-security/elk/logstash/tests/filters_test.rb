require 'json'
require 'rspec'

module ObservabilityLogstashPipeline
  module_function

  def process(event)
    output = deep_copy(event)
    service_name = output.dig('container', 'name')
    output['service_name'] = service_name if service_name

    parse_j3_json(output) if service_name&.match?(/j3-dms$/)
    parse_kong_access_log(output) if service_name&.match?(/kong$/)
    extract_trace_fields(output)

    output
  rescue JSON::ParserError
    output
  end

  def parse_j3_json(event)
    parsed = JSON.parse(event['message'])
    event['j3'] = parsed
    event['log.level'] = parsed['level'] if parsed['level']
    event['request_id'] = parsed['requestId'] if parsed['requestId']
    event['trace.id'] = parsed['traceId'] if parsed['traceId']
  end

  def parse_kong_access_log(event)
    match = event['message'].match(
      %r{(?<client_ip>\S+) - (?<user_name>.+?) \[(?<kong_access_time>[^\]]+)\] "(?<http_method>\S+) (?<url_original>.+?) HTTP/(?<http_version>[^"]+)" (?<http_status>\d+) (?<response_bytes>\d+) "(?<referrer>[^"]*)" "(?<user_agent>[^"]*)"}
    )
    return unless match

    event['client.ip'] = match[:client_ip]
    event['user.name'] = match[:user_name]
    event['kong.access.time'] = match[:kong_access_time]
    event['http.request.method'] = match[:http_method]
    event['url.original'] = match[:url_original]
    event['http.version'] = match[:http_version]
    event['http.response.status_code'] = match[:http_status].to_i
    event['http.response.body.bytes'] = match[:response_bytes].to_i
    event['http.request.referrer'] = match[:referrer]
    event['user_agent.original'] = match[:user_agent]
  end

  def extract_trace_fields(event)
    message = event['message'].to_s
    trace_match = message.match(/(?:trace[_-]?id|traceId)[=: ](?<trace_id>\S+)/)
    request_match = message.match(/(?:request[_-]?id|requestId)[=: ](?<request_id>\S+)/)

    event['trace.id'] ||= trace_match[:trace_id] if trace_match
    event['request_id'] ||= request_match[:request_id] if request_match
  end

  def deep_copy(value)
    Marshal.load(Marshal.dump(value))
  end
end

RSpec.describe 'Observability Logstash filters' do
  it 'parses j3-dms JSON logs and promotes trace fields' do
    input = {
      'message' => '{"level":"ERROR","requestId":"req-123","traceId":"trace-abc","message":"DB error"}',
      'container' => { 'name' => 'j3-dms' }
    }

    output = ObservabilityLogstashPipeline.process(input)

    expect(output['service_name']).to eq('j3-dms')
    expect(output['j3']['message']).to eq('DB error')
    expect(output['log.level']).to eq('ERROR')
    expect(output['request_id']).to eq('req-123')
    expect(output['trace.id']).to eq('trace-abc')
  end

  it 'parses Kong access logs into structured fields' do
    input = {
      'message' => '192.168.1.100 - admin [01/May/2026:12:34:56 +0000] "POST /api/incidents HTTP/1.1" 201 1024 "-" "curl/7.64.1"',
      'container' => { 'name' => 'kong' }
    }

    output = ObservabilityLogstashPipeline.process(input)

    expect(output['client.ip']).to eq('192.168.1.100')
    expect(output['user.name']).to eq('admin')
    expect(output['http.request.method']).to eq('POST')
    expect(output['url.original']).to eq('/api/incidents')
    expect(output['http.response.status_code']).to eq(201)
    expect(output['http.response.body.bytes']).to eq(1024)
    expect(output['user_agent.original']).to eq('curl/7.64.1')
  end

  it 'extracts trace and request IDs from plaintext logs' do
    input = {
      'message' => 'completed request trace_id=trace-456 requestId=req-789',
      'container' => { 'name' => 'any-service' }
    }

    output = ObservabilityLogstashPipeline.process(input)

    expect(output['trace.id']).to eq('trace-456')
    expect(output['request_id']).to eq('req-789')
  end

  it 'skips malformed JSON without crashing' do
    input = {
      'message' => '{"level":"ERROR","requestId":"broken',
      'container' => { 'name' => 'j3-dms' }
    }

    output = ObservabilityLogstashPipeline.process(input)

    expect(output['service_name']).to eq('j3-dms')
    expect(output['j3']).to be_nil
  end
end
