import 'package:geolocator/geolocator.dart';

class GpsService {
  static Future<bool> isLocationServiceEnabled() async {
    return Geolocator.isLocationServiceEnabled();
  }

  static Future<LocationPermission> requestPermission() async {
    LocationPermission permission = await Geolocator.checkPermission();

    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }

    return permission;
  }

  static Future<Position?> getCurrentPosition() async {
    final enabled = await Geolocator.isLocationServiceEnabled();
    if (!enabled) {
      return null;
    }

    final permission = await requestPermission();
    if (permission == LocationPermission.denied ||
        permission == LocationPermission.deniedForever) {
      return null;
    }

    try {
      return await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
      );
    } catch (_) {
      return null;
    }
  }

  static String formatPosition(Position position) {
    return '${position.latitude.toStringAsFixed(6)}, ${position.longitude.toStringAsFixed(6)}';
  }
}
