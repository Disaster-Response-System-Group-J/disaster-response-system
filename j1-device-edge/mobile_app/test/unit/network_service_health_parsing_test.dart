import 'package:flutter_test/flutter_test.dart';

import 'package:offline_app/services/database_helper.dart';
import 'package:offline_app/services/network_service.dart';

import '../helpers/j1_test_server.dart';
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

  group('NetworkService.isOnline', () {
    test('returns true when /health matches expected JSON', () async {
      final server = await J1TestServer.start();
      addTearDown(server.close);

      await DatabaseHelper.instance.setApiBaseUrl(server.baseUri.toString());

      final online = await NetworkService.isOnline();
      expect(online, isTrue);
    });

    test('returns false when service name is unexpected', () async {
      final server = await J1TestServer.start(
        healthBody: <String, dynamic>{
          'status': 'ok',
          'service': 'something-else',
        },
      );
      addTearDown(server.close);

      await DatabaseHelper.instance.setApiBaseUrl(server.baseUri.toString());

      final online = await NetworkService.isOnline();
      expect(online, isFalse);
    });

    test('returns false when status code is not 200', () async {
      final server = await J1TestServer.start(healthStatusCode: 503);
      addTearDown(server.close);

      await DatabaseHelper.instance.setApiBaseUrl(server.baseUri.toString());

      final online = await NetworkService.isOnline();
      expect(online, isFalse);
    });
  });
}
