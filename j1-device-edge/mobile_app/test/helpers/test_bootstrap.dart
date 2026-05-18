import 'package:flutter_test/flutter_test.dart';
import 'package:sqflite/sqflite.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

import 'package:offline_app/services/database_helper.dart';

/// Shared bootstrap for running J1-focused tests on the Dart VM.
///
/// Uses `sqflite_common_ffi` so DatabaseHelper works in `flutter test`.
class TestBootstrap {
  static bool _initialized = false;

  static Future<void> init() async {
    if (_initialized) return;

    TestWidgetsFlutterBinding.ensureInitialized();

    sqfliteFfiInit();
    databaseFactory = databaseFactoryFfi;

    _initialized = true;
  }

  /// Resets persisted state used by J1 app flows (events/resources/session/meta).
  ///
  /// Call in `setUp()` to keep tests isolated.
  static Future<void> resetState() async {
    await init();

    // Ensure DB exists.
    await DatabaseHelper.instance.database;

    // Keep tests independent.
    await DatabaseHelper.instance.clearAllEvents();
    await DatabaseHelper.instance.clearResources();
    await DatabaseHelper.instance.clearCurrentSession();
    await DatabaseHelper.instance.clearApiBaseUrl();
  }

  static Future<void> dispose() async {
    await init();
    await DatabaseHelper.instance.closeDatabase();
  }
}
