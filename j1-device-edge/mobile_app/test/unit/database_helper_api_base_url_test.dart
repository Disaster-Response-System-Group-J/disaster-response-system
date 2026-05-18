import 'package:flutter_test/flutter_test.dart';

import 'package:offline_app/services/database_helper.dart';

import '../helpers/test_bootstrap.dart';

void main() {
  setUpAll(() async {
    await TestBootstrap.init();
  });

  setUp(() async {
    await TestBootstrap.resetState();
  });

  tearDown(() async {
    await TestBootstrap.dispose();
  });

  group('DatabaseHelper api_base_url', () {
    test('normalizes scheme and strips trailing slash/path', () async {
      await DatabaseHelper.instance.setApiBaseUrl('127.0.0.1:8081/health');
      final value = await DatabaseHelper.instance.getApiBaseUrl();
      expect(value, 'http://127.0.0.1:8081');
    });

    test('rejects invalid base URL', () async {
      expect(
        () => DatabaseHelper.instance.setApiBaseUrl('not a url'),
        throwsException,
      );
    });
  });
}
