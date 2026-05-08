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

        if (response == 200 || response == 202) {
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

      final eventPayload = jsonEncode({
        'eventId': event.eventId,
        'eventType': event.type,
        'eventVersion': event.eventVersion,
        'timestamp': event.createdAt,
        'userId': event.userId,
        'deviceId': event.deviceId,
        'payload': jsonDecode(event.data),
        'metadata': event.metadata,
      });

      request.write(eventPayload);

      final response = await request.close().timeout(
            Duration(seconds: AppConstants.syncTimeoutSeconds),
          );

      final responseBody = await response.transform(utf8.decoder).join();
      if (response.statusCode == 200 || response.statusCode == 202 || response.statusCode == 409) {
        print('POST $uri -> HTTP ${response.statusCode}');
      } else {
        final preview = responseBody.length > 200
            ? '${responseBody.substring(0, 200)}...'
            : responseBody;
        print('POST $uri -> HTTP ${response.statusCode}; body=$preview');
      }
      return response.statusCode;
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
