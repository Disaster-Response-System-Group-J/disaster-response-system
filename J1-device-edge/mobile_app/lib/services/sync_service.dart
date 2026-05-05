import 'dart:async';
import 'dart:convert';
import 'dart:io';

import '../models/event_model.dart';
import '../utills/constants.dart';
import 'database_helper.dart';
import 'network_service.dart';

class SyncService {
  final DatabaseHelper dbHelper = DatabaseHelper.instance;
  
  Timer? _timer;
  bool _syncing = false;

  Future<void> start() async {
    listenNetwork();

    // Ensure network polling is running.
    NetworkService.startListening();
    unawaited(NetworkService.checkConnection());

    // Attempt an initial flush without blocking startup flows.
    unawaited(syncQueuedEvents());

    // Poll every 30 seconds (production-grade)
    _timer = Timer.periodic(
      const Duration(seconds: AppConstants.syncPollingIntervalSeconds),
      (_) => syncQueuedEvents(),
    );
  }

  void listenNetwork() {
    NetworkService.onNetworkChange.listen((isOnline) {
      if (isOnline) {
        print('✓ Network available, triggering sync');
        syncQueuedEvents();
      } else {
        print('⚠ Offline - sync postponed');
      }
    });
  }

  Future<void> syncQueuedEvents() async {
    if (_syncing) return;
    _syncing = true;

    try {
      final isOnline = await NetworkService.isOnline();
      if (!isOnline) {
        print('⚠ Offline - sync postponed');
        return;
      }

      final queuedEvents = await dbHelper.getQueuedEvents();
      if (queuedEvents.isEmpty) {
        print('ℹ No queued events');
        return;
      }

      print('🔄 Syncing ${queuedEvents.length} events');
      for (var event in queuedEvents) {
        await _sendEventWithRetry(event);
      }
    } catch (e) {
      print('✗ Sync error: $e');
    } finally {
      _syncing = false;
    }
  }

  /// Send event with exponential backoff retry (production-grade)
  /// Exponential backoff: 2s, 4s, 6s, 8s, 10s (max 5 attempts)
  Future<void> _sendEventWithRetry(EventModel event) async {
    for (int attempt = 0; attempt < AppConstants.maxSyncRetries; attempt++) {
      try {
        final response = await _sendEvent(event);

        if (response == 200 || response == 202) {
          // ✓ Success (200) or Accepted (202)
          await dbHelper.updateEventStatus(
            eventId: event.eventId,
            status: AppConstants.statusSubmitted,
            submittedAt: DateTime.now().toIso8601String(),
          );
          print('✓ Event synced: ${event.eventId}');
          return; // Exit retry loop
        } else if (response == 409) {
          // ⚠ Duplicate - event already processed
          await dbHelper.updateEventStatus(
            eventId: event.eventId,
            status: AppConstants.statusDuplicate,
            submittedAt: DateTime.now().toIso8601String(),
          );
          print('⚠ Duplicate: ${event.eventId}');
          return; // Exit retry loop
        } else {
          // 5xx or other error - retry
          throw HttpException('HTTP $response');
        }
      } catch (e) {
        if (attempt < AppConstants.maxSyncRetries - 1) {
          // Exponential backoff: 2s * (attempt + 1)
          final backoffMs = 2000 * (attempt + 1);
          print(
            '⏳ Attempt ${attempt + 1} failed, retrying in ${backoffMs}ms'
          );
          await Future.delayed(Duration(milliseconds: backoffMs));
        }
      }
    }

    // Max retries exceeded
    await dbHelper.incrementSyncAttempts(event.eventId,
        error: 'Failed after ${AppConstants.maxSyncRetries} attempts');
    print(
      '✗ Failed to sync ${event.eventId} after ${AppConstants.maxSyncRetries} attempts'
    );
  }

  /// Send event HTTP request with Idempotency-Key header (PRODUCTION)
  /// Returns HTTP status code or throws exception
  Future<int> _sendEvent(EventModel event) async {
    try {
      final client = HttpClient();
      final uri =
          Uri.parse('${AppConstants.apiBaseUrl}${AppConstants.apiIngestEndpoint}');

      final request = await client.postUrl(uri).timeout(
        Duration(seconds: AppConstants.syncTimeoutSeconds),
      );

      // Set headers
      request.headers.contentType = ContentType.json;
      request.headers.set('Idempotency-Key', event.eventId); // ← CRITICAL

      // Build complete event envelope (production-grade)
      // Note: appVersion and osVersion can be enhanced later by adding device_info_plus + package_info_plus
      final String osVersion = Platform.isAndroid ? 'Android' : Platform.isIOS ? 'iOS' : 'Unknown';

      final eventPayload = jsonEncode({
        'eventId': event.eventId,
        'eventType': event.type,
        'eventVersion': '1.0',
        'timestamp': DateTime.now().toIso8601String(),
        'userId': event.userId,
        'deviceId': event.deviceId,
        'payload': jsonDecode(event.data),
        'metadata': event.metadata,
      });

      request.write(eventPayload);

      final response = await request.close().timeout(
        Duration(seconds: AppConstants.syncTimeoutSeconds),
      );

      print('POST ${AppConstants.apiIngestEndpoint} → HTTP ${response.statusCode}');
      return response.statusCode;
    } on SocketException catch (e) {
      print('✗ Network error: $e');
      rethrow;
    } on TimeoutException catch (e) {
      print('✗ Request timeout: $e');
      rethrow;
    }
  }

  void stop() {
    _timer?.cancel();
    print('Sync service stopped');
  }

  Future<void> debugDatabaseStatus() async {
    try {
      final allEvents = await dbHelper.getAllEvents();
      final queuedEvents = await dbHelper.getQueuedEvents();
      final submittedEvents = await dbHelper.getSubmittedEvents();
      
      print('=== DATABASE DEBUG ===');
      print('Total events: ${allEvents.length}');
      print('Queued events: ${queuedEvents.length}');
      print('Submitted events: ${submittedEvents.length}');
      
      for (var event in allEvents) {
        print('  - ${event.eventId}: ${event.status} (${event.type})');
      }
    } catch (e) {
      print('DEBUG ERROR: $e');
    }
  }
}