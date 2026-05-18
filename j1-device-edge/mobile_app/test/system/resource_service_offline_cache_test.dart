import 'package:flutter_test/flutter_test.dart';

import 'package:offline_app/services/database_helper.dart';
import 'package:offline_app/services/resource_service.dart';

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

  test('ResourceService caches backend data and serves it offline', () async {
    final nowIso = DateTime.now().toUtc().toIso8601String();

    final server = await J1TestServer.start(
      resourcesBody: <dynamic>[
        <String, dynamic>{
          'id': 'r1',
          'type': 'SHELTER',
          'name': 'Test Shelter',
          'district': 'Colombo',
          'status': 'AVAILABLE',
          'latitude': 6.9,
          'longitude': 79.8,
          'capacity': 100,
          'currentLoad': 20,
          'lastUpdated': nowIso,
        },
      ],
    );

    await DatabaseHelper.instance.setApiBaseUrl(server.baseUri.toString());

    final first = await ResourceService.instance.fetchAndCacheResources();
    expect(first, isNotEmpty);
    expect(first.first.name, 'Test Shelter');

    final cachedCount = await DatabaseHelper.instance.getResourcesCount();
    expect(cachedCount, 1);

    // Go offline by stopping the server. NetworkService.isOnline() will fail.
    await server.close();

    final second = await ResourceService.instance.fetchAndCacheResources();
    expect(second, isNotEmpty);
    expect(second.first.name, 'Test Shelter');
  });
}
