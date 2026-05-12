import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;

import '../utills/constants.dart';
import 'database_helper.dart';

class NetworkService {
  static final StreamController<bool> _controller =
      StreamController<bool>.broadcast();

  static Stream<bool> get onNetworkChange => _controller.stream;

  static Timer? _timer;
  static bool _checking = false;
  static bool? _lastStatus;

  /// Check whether the J1 bridge API is reachable.
  ///
  /// This avoids depending on public internet access when the local bridge is
  /// running on a laptop or disaster-response LAN.
  static Future<bool> isOnline({
    Duration timeout = const Duration(seconds: 5),
  }) async {
    try {
      final baseUrl = await DatabaseHelper.instance.getApiBaseUrl();
      final uri = Uri.parse(
        '$baseUrl${AppConstants.apiHealthEndpoint}',
      );
      print('[NetworkService] Checking health: $uri');
        print('[NetworkService] DEBUG: baseUrl from DB: "$baseUrl"');
        print('[NetworkService] DEBUG: apiHealthEndpoint: "${AppConstants.apiHealthEndpoint}"');
        print('[NetworkService] DEBUG: constructed full string before parse: "$baseUrl${AppConstants.apiHealthEndpoint}"');
      final response = await http.get(uri).timeout(timeout);
      print('[NetworkService] Health response status: ${response.statusCode}');
      print('[NetworkService] Health response body: ${response.body}');
      
      if (response.statusCode != 200) {
        print('[NetworkService] ❌ Status code is not 200, returning false');
        return false;
      }

      final dynamic decoded = jsonDecode(response.body);
      print('[NetworkService] Parsed JSON: $decoded');
      if (decoded is! Map<String, dynamic>) {
        print('[NetworkService] ❌ Response is not a Map, returning false');
        return false;
      }

      final status = decoded['status']?.toString();
      final service = decoded['service']?.toString();
      print('[NetworkService] Checking: status=$status, service=$service');
      
      final isHealthy = status == 'ok' && service == 'j1-bridge-api';
      print('[NetworkService] ${isHealthy ? '✅ Online' : '❌ Not online'} - health check result: $isHealthy');
      return isHealthy;
    } catch (e, stackTrace) {
      print('[NetworkService] ❌ Exception during health check: $e');
      print('[NetworkService] Stack trace: $stackTrace');
      return false;
    }
  }

  static Future<void> _tick({bool forceEmit = false}) async {
    if (_checking) {
      return;
    }
    _checking = true;
    try {
      final status = await isOnline();
      if (forceEmit || _lastStatus != status) {
        _lastStatus = status;
        _controller.add(status);
      }
    } finally {
      _checking = false;
    }
  }

  static void startListening({Duration interval = const Duration(seconds: 5)}) {
    _timer?.cancel();
    _timer = Timer.periodic(interval, (_) {
      _tick();
    });
  }

  static Future<void> checkConnection() async {
    await _tick(forceEmit: true);
  }

  static void dispose() {
    _timer?.cancel();
    _controller.close();
  }
}
