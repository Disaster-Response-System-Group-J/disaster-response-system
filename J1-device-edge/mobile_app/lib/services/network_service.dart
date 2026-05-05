import 'dart:async';
import 'dart:io';

import 'mqtt_config.dart';

class NetworkService {
  static final StreamController<bool> _controller =
      StreamController<bool>.broadcast();

  static Stream<bool> get onNetworkChange => _controller.stream;

  static Timer? _timer;
  static bool _checking = false;
  static bool? _lastStatus;

  /// Consider the app "online" when the MQTT broker is reachable.
  ///
  /// This is more reliable than checking a public host (like google.com) which
  /// may be blocked even when the device can reach the broker.
  static Future<bool> isOnline({
    Duration timeout = const Duration(seconds: 2),
  }) async {
    try {
      final socket = await Socket.connect(
        MqttConfig.broker,
        MqttConfig.port,
        timeout: timeout,
      );
      socket.destroy();
      return true;
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