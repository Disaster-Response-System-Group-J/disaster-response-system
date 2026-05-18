import 'dart:async';
import 'dart:convert';
import 'dart:io';

class J1TestServer {
  J1TestServer._(this._server);

  final HttpServer _server;

  final List<Map<String, dynamic>> ingestRequests = <Map<String, dynamic>>[];

  Uri get baseUri => Uri.parse('http://127.0.0.1:${_server.port}');

  static Future<J1TestServer> start({
    int healthStatusCode = 200,
    Map<String, dynamic>? healthBody,
    int ingestStatusCode = 201,
    Map<String, dynamic> Function(Map<String, dynamic> body)? ingestBodyToResponse,
    int resourcesStatusCode = 200,
    Object? resourcesBody,
  }) async {
    final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    final instance = J1TestServer._(server);

    unawaited(() async {
      await for (final request in server) {
        try {
          final path = request.uri.path;

          if (request.method == 'GET' && path == '/health') {
            final body = healthBody ?? <String, dynamic>{
              'status': 'ok',
              'service': 'j1-bridge-api',
            };
            await _json(request, healthStatusCode, body);
            continue;
          }

          if (request.method == 'POST' && path == '/api/v1/ingest/report') {
            final raw = await utf8.decoder.bind(request).join();
            final decoded = jsonDecode(raw);
            final body = decoded is Map<String, dynamic>
                ? decoded
                : <String, dynamic>{'raw': decoded};

            instance.ingestRequests.add(body);

            final response = ingestBodyToResponse?.call(body) ?? <String, dynamic>{
              'success': ingestStatusCode >= 200 && ingestStatusCode < 300,
              'data': <String, dynamic>{'eventId': body['eventId']},
              'error': ingestStatusCode >= 400 ? 'HTTP $ingestStatusCode' : null,
            };
            await _json(request, ingestStatusCode, response);
            continue;
          }

          if (request.method == 'GET' && path == '/api/v1/resources') {
            final body = resourcesBody ?? <dynamic>[];
            await _json(request, resourcesStatusCode, body);
            continue;
          }

          await _json(request, 404, <String, dynamic>{
            'error': 'Not found',
            'path': path,
          });
        } catch (e) {
          await _json(request, 500, <String, dynamic>{
            'error': e.toString(),
          });
        }
      }
    }());

    return instance;
  }

  Future<void> close() async {
    await _server.close(force: true);
  }

  static Future<void> _json(HttpRequest request, int statusCode, Object body) async {
    request.response.statusCode = statusCode;
    request.response.headers.contentType = ContentType.json;
    request.response.write(jsonEncode(body));
    await request.response.close();
  }
}
