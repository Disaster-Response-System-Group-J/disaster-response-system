import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

import 'package:offline_app/services/database_helper.dart';
import 'package:offline_app/services/network_service.dart';
import 'package:offline_app/services/resource_service.dart';

import '../helpers/test_bootstrap.dart';

void main() {
  final baseUrl = Platform.environment['J1_INTEGRATION_BASE_URL'];
  final skipReason = baseUrl == null || baseUrl.trim().isEmpty
      ? 'Set env var J1_INTEGRATION_BASE_URL (e.g. http://127.0.0.1:8081) to run this test.'
      : null;

  setUpAll(() async {
    await TestBootstrap.init();
  });

  setUp(() async {
    await TestBootstrap.resetState();
  });

  tearDown(() async {
    await TestBootstrap.dispose();
  });

  test('J1 backend health + resources smoke', () async {
    await DatabaseHelper.instance.setApiBaseUrl(baseUrl!);

    final online = await NetworkService.isOnline();
    expect(online, isTrue);

    final resources = await ResourceService.instance.fetchAndCacheResources();
    // We only assert it returns a list; the demo backend may change counts.
    expect(resources, isA<List>());
  }, skip: skipReason);
}
