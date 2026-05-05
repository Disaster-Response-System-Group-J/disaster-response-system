import 'dart:async';
import 'dart:io';

class NetworkService {
  static final StreamController<bool> _controller =
      StreamController<bool>.broadcast();

  static Stream<bool> get onNetworkChange => _controller.stream;

  static Timer? _timer;
  static bool _checking = false;
  static bool? _lastStatus;

  /// Check internet connectivity via HTTP to a reliable endpoint.
  ///
  /// This is more portable than MQTT broker checks and works for any network.
  static Future<bool> isOnline({
    Duration timeout = const Duration(seconds: 5),
  }) async {
    try {
      final request = await HttpClient()
          .getUrl(Uri.parse('https://www.google.com'))
          .timeout(timeout);
      final response = await request.close().timeout(timeout);
      return response.statusCode == 200;
    } catch (_) {
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