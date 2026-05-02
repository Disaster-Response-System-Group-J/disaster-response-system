import 'dart:async';
import 'dart:io';

class NetworkService {
  static final StreamController<bool> _controller =
      StreamController<bool>.broadcast();

  static Stream<bool> get onNetworkChange => _controller.stream;

  static Timer? _timer;
  static Future<bool> isOnline() async {
    try {
      final result = await InternetAddress.lookup('google.com');
      return result.isNotEmpty && result[0].rawAddress.isNotEmpty;
    } catch (_) {
      return false;
    }
  }
  static void startListening() {
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 10), (_) async {
      _controller.add(await isOnline());
    });
  }
  static Future<void> checkConnection() async {
    final status = await isOnline();
    _controller.add(status);
  }
  static void dispose() {
    _timer?.cancel();
    _controller.close();
  }
}