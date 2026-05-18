import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:offline_app/services/database_helper.dart';
import 'package:offline_app/widgets/offline_banner.dart';

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

  testWidgets('shows Online banner when J1 /health is ok', (tester) async {
    final server = await J1TestServer.start();
    addTearDown(server.close);

    await DatabaseHelper.instance.setApiBaseUrl(server.baseUri.toString());

    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(body: OfflineBanner()),
      ),
    );

    // Triggers post-frame refresh.
    await tester.pump();

    // Allow async refresh to complete.
    await tester.runAsync(() async {
      await Future<void>.delayed(const Duration(milliseconds: 150));
    });
    await tester.pump();

    expect(find.textContaining('Online.'), findsOneWidget);
  });

  testWidgets('shows Offline banner when J1 /health is down', (tester) async {
    final server = await J1TestServer.start(healthStatusCode: 503);
    addTearDown(server.close);

    await DatabaseHelper.instance.setApiBaseUrl(server.baseUri.toString());

    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(body: OfflineBanner()),
      ),
    );

    await tester.pump();

    await tester.runAsync(() async {
      await Future<void>.delayed(const Duration(milliseconds: 150));
    });
    await tester.pump();

    expect(find.textContaining('Offline.'), findsOneWidget);
  });
}
