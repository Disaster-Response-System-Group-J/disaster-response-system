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
  StreamSubscription<bool>? _networkSubscription;

  Future<void> start() async {
    // Reset sync_attempts on any QUEUED events so they get a fresh retry
    // after an app restart. This recovers events that exhausted retries in a
    // previous session (e.g. due to wrong payload format or API being down).
    await dbHelper.resetQueuedEventAttempts();

    listenNetwork();

    NetworkService.startListening();
    unawaited(NetworkService.checkConnection());
    unawaited(syncQueuedEvents());

    _timer = Timer.periodic(
      const Duration(seconds: AppConstants.syncPollingIntervalSeconds),
      (_) => syncQueuedEvents(),
    );
  }

  void listenNetwork() {
    _networkSubscription ??= NetworkService.onNetworkChange.listen((isOnline) {
      if (isOnline) {
        print('Network available, triggering sync');
        unawaited(syncQueuedEvents());
      } else {
        print('Offline - sync postponed');
      }
    });
  }

  Future<void> syncQueuedEvents() async {
    if (_syncing) return;
    _syncing = true;

    try {
      final isOnline = await NetworkService.isOnline();
      if (!isOnline) {
        print('Offline - sync postponed');
        return;
      }

      final queuedEvents = await dbHelper.getQueuedEvents();
      if (queuedEvents.isEmpty) {
        print('No queued events');
        return;
      }

      print('Syncing ${queuedEvents.length} events');
      for (final event in queuedEvents) {
        await _sendEventWithRetry(event);
      }
    } catch (e) {
      print('Sync error: $e');
    } finally {
      _syncing = false;
    }
  }

  Future<void> _sendEventWithRetry(EventModel event) async {
    Object? lastError;

    for (int attempt = 0; attempt < AppConstants.maxSyncRetries; attempt++) {
      try {
        final response = await _sendEvent(event);

        if (response == 200 || response == 201 || response == 202) {
          await dbHelper.updateEventStatus(
            eventId: event.eventId,
            status: AppConstants.statusSubmitted,
            submittedAt: DateTime.now().toIso8601String(),
          );
          print('Event synced: ${event.eventId}');
          return;
        }

        if (response == 409) {
          await dbHelper.updateEventStatus(
            eventId: event.eventId,
            status: AppConstants.statusDuplicate,
            submittedAt: DateTime.now().toIso8601String(),
          );
          print('Duplicate event: ${event.eventId}');
          return;
        }

        // 422 = validation error — retrying will never help, mark failed immediately
        if (response == 422 || response == 400) {
          await dbHelper.updateEventStatus(
            eventId: event.eventId,
            status: AppConstants.statusFailed,
            lastSyncError: 'Server rejected payload: HTTP $response',
          );
          print('Event permanently failed (HTTP $response): ${event.eventId}');
          return;
        }

        throw HttpException('HTTP $response');
      } catch (e) {
        lastError = e;
        if (attempt < AppConstants.maxSyncRetries - 1) {
          final backoffMs = 2000 * (attempt + 1);
          print('Attempt ${attempt + 1} failed, retrying in ${backoffMs}ms');
          await Future.delayed(Duration(milliseconds: backoffMs));
        }
      }
    }

    await dbHelper.incrementSyncAttempts(
      event.eventId,
      error: lastError?.toString() ??
          'Failed after ${AppConstants.maxSyncRetries} attempts',
    );
    print(
      'Failed to sync ${event.eventId} after ${AppConstants.maxSyncRetries} attempts',
    );
  }

  Future<int> _sendEvent(EventModel event) async {
    final client = HttpClient();
    try {
      final baseUrl = await dbHelper.getApiBaseUrl();
      final uri = Uri.parse(
        '$baseUrl${AppConstants.apiIngestEndpoint}',
      );

      final request = await client.postUrl(uri).timeout(
            Duration(seconds: AppConstants.syncTimeoutSeconds),
          );

      request.headers.contentType = ContentType.json;
      request.headers.set('Accept', 'application/json');
      request.headers.set('Idempotency-Key', event.eventId);

      // Decode the inner payload stored in SQLite
      final inner = jsonDecode(event.data) as Map<String, dynamic>;

      // Build the flat body the API expects at /api/v1/ingest/report
      final eventPayload = jsonEncode({
        'eventId': event.eventId,
        'deviceId': event.deviceId,
        'timestamp': event.createdAt,
        // Map HELP_REQUEST fields → ReportIngestPayload fields
        'disasterType': _mapEventTypeToDisasterType(event.type, inner),
        'district': inner['district']?.toString() ?? 'Unknown',
        'latitude': (inner['latitude'] as num?)?.toDouble() ?? 0.0,
        'longitude': (inner['longitude'] as num?)?.toDouble() ?? 0.0,
        'description': _buildDescription(inner),
        'contact': inner['contact']?.toString(),
        'mediaUrls': inner['mediaUrls'] ?? [],
      });

      request.write(eventPayload);

      final response = await request.close().timeout(
            Duration(seconds: AppConstants.syncTimeoutSeconds),
          );

      final responseBody = await response.transform(utf8.decoder).join();
      final code = response.statusCode;
      if (code == 200 || code == 201 || code == 202 || code == 409) {
        print('POST $uri -> HTTP $code ✓');
      } else {
        final preview = responseBody.length > 300
            ? '${responseBody.substring(0, 300)}...'
            : responseBody;
        print('POST $uri -> HTTP $code ✗ body=$preview');
      }
      return code;
    } on SocketException catch (e) {
      print('Network error: $e');
      rethrow;
    } on TimeoutException catch (e) {
      print('Request timeout: $e');
      rethrow;
    } finally {
      client.close(force: true);
    }
  }

  void stop() {
    _timer?.cancel();
    _networkSubscription?.cancel();
    _networkSubscription = null;
    print('Sync service stopped');
  }

  /// Maps the mobile event type + inner payload to one of FLOOD|LANDSLIDE|DROUGHT.
  /// HELP_REQUEST events use request_type to pick the best match.
  String _mapEventTypeToDisasterType(String eventType, Map<String, dynamic> inner) {
    if (eventType == 'DISASTER_REPORT') {
      final dt = inner['disasterType']?.toString().toUpperCase() ?? '';
      if (dt == 'FLOOD' || dt == 'LANDSLIDE' || dt == 'DROUGHT') return dt;
    }
    // HELP_REQUEST — pick based on request_type context, default to FLOOD
    final requestType = inner['request_type']?.toString().toLowerCase() ?? '';
    if (requestType.contains('landslide')) return 'LANDSLIDE';
    if (requestType.contains('drought') || requestType.contains('water')) return 'DROUGHT';
    return 'FLOOD';
  }

  /// Builds a description string that satisfies the API's 10-char minimum.
  String _buildDescription(Map<String, dynamic> inner) {
    final parts = <String>[];

    final requestType = inner['request_type']?.toString();
    if (requestType != null && requestType.isNotEmpty) parts.add(requestType);

    final desc = inner['description']?.toString();
    if (desc != null && desc.isNotEmpty) parts.add(desc);

    final location = inner['location']?.toString();
    if (location != null && location.isNotEmpty) parts.add('Location: $location');

    final count = inner['people_count'];
    if (count != null) parts.add('People: $count');

    final result = parts.join(' | ');
    // Pad to minimum 10 chars if somehow still short
    return result.length >= 10 ? result : result.padRight(10, '.');
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

      for (final event in allEvents) {
        print('  - ${event.eventId}: ${event.status} (${event.type})');
      }
    } catch (e) {
      print('DEBUG ERROR: $e');
    }
  }
}
