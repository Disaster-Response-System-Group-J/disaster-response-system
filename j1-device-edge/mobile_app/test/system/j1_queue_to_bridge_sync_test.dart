import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';

import 'package:offline_app/models/event_model.dart';
import 'package:offline_app/services/auth_service.dart';
import 'package:offline_app/services/database_helper.dart';
import 'package:offline_app/services/offline_queue_manager.dart';
import 'package:offline_app/services/sync_service.dart';
import 'package:offline_app/utills/constants.dart';

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

  group('System flow: offline queue -> J1 bridge ingest -> status update', () {
    Future<EventModel> _queueOneHelpRequest({required String userId}) async {
      final manager = OfflineQueueManager();

      await manager.addEvent(
        <String, dynamic>{
          'request_type': 'Need water',
          'district': 'Colombo',
          'latitude': 6.9271,
          'longitude': 79.8612,
          'description': 'Family needs clean drinking water',
          'people_count': 3,
          'location': 'Near main road',
          'contact': '0712345678',
          'mediaUrls': <String>[],
        },
        'HELP_REQUEST',
        userId: userId,
        deviceId: 'test-device-1',
      );

      final queued = await DatabaseHelper.instance.getQueuedEvents();
      expect(queued, hasLength(1));
      return queued.first;
    }

    test('201 -> marks event SUBMITTED and sends expected body', () async {
      final server = await J1TestServer.start(ingestStatusCode: 201);
      addTearDown(server.close);

      await DatabaseHelper.instance.setApiBaseUrl(server.baseUri.toString());

      final user = await AuthService.instance.loginWithMockUser();
      final event = await _queueOneHelpRequest(userId: user.id);

      final sync = SyncService();
      await sync.syncQueuedEvents();

      final all = await DatabaseHelper.instance.getAllEvents();
      expect(all, hasLength(1));
      expect(all.first.status, AppConstants.statusSubmitted);

      expect(server.ingestRequests, hasLength(1));
      final sent = server.ingestRequests.single;
      expect(sent['eventId'], event.eventId);
      expect(sent['deviceId'], 'test-device-1');
      expect(sent['district'], 'Colombo');
      expect(sent['disasterType'], 'DROUGHT'); // derived from request_type containing "water"
      expect((sent['description'] as String).length, greaterThanOrEqualTo(10));
    });

    test('409 -> marks event DUPLICATE', () async {
      final server = await J1TestServer.start(ingestStatusCode: 409);
      addTearDown(server.close);

      await DatabaseHelper.instance.setApiBaseUrl(server.baseUri.toString());

      final user = await AuthService.instance.loginWithMockUser();
      await _queueOneHelpRequest(userId: user.id);

      final sync = SyncService();
      await sync.syncQueuedEvents();

      final all = await DatabaseHelper.instance.getAllEvents();
      expect(all.single.status, AppConstants.statusDuplicate);
    });

    test('422 -> marks event FAILED with last_sync_error', () async {
      final server = await J1TestServer.start(ingestStatusCode: 422);
      addTearDown(server.close);

      await DatabaseHelper.instance.setApiBaseUrl(server.baseUri.toString());

      final user = await AuthService.instance.loginWithMockUser();
      await _queueOneHelpRequest(userId: user.id);

      final sync = SyncService();
      await sync.syncQueuedEvents();

      final all = await DatabaseHelper.instance.getAllEvents();
      expect(all.single.status, AppConstants.statusFailed);
      expect(all.single.lastSyncError, contains('HTTP 422'));
    });

    test('duplicate payload is not queued twice', () async {
      final server = await J1TestServer.start(ingestStatusCode: 201);
      addTearDown(server.close);

      await DatabaseHelper.instance.setApiBaseUrl(server.baseUri.toString());

      final user = await AuthService.instance.loginWithMockUser();
      final manager = OfflineQueueManager();

      final payload = <String, dynamic>{
        'request_type': 'Need water',
        'district': 'Colombo',
        'latitude': 6.9271,
        'longitude': 79.8612,
        'description': 'Family needs clean drinking water',
        'people_count': 3,
        'location': 'Near main road',
      };

      await manager.addEvent(payload, 'HELP_REQUEST', userId: user.id, deviceId: 'test-device-1');
      await manager.addEvent(payload, 'HELP_REQUEST', userId: user.id, deviceId: 'test-device-1');

      final queued = await DatabaseHelper.instance.getQueuedEvents();
      expect(queued, hasLength(1));

      // Ensure payload signature match is what prevented duplication.
      final stored = jsonDecode(queued.first.data) as Map<String, dynamic>;
      expect(stored['district'], 'Colombo');
    });
  });
}
