import 'dart:async';
import 'dart:io';

class NetworkService {
  static final StreamController<bool> _controller =
      StreamController<bool>.broadcast();

  static Stream<bool> get onNetworkChange => _controller.stream;

  static Future<bool> isOnline() async {
    try {
      final result = await InternetAddress.lookup('google.com');
      return result.isNotEmpty;
    } catch (_) {
      return false;
    }
  }

  static Future<void> checkConnection() async {
    final status = await isOnline();
    _controller.add(status);
  }
}