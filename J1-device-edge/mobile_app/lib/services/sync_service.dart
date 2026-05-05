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

    _timer = Timer.periodic(const Duration(seconds: 10), (timer) {
      syncQueuedEvents();
    });
  }

  void listenNetwork() {
    NetworkService.onNetworkChange.listen((isOnline) {
      if (isOnline) {
        print('Network available, syncing');
        syncQueuedEvents();
      } else {
        print('Offline mode');
      }
    });
  }

  Future<void> syncQueuedEvents() async {
    if (_syncing) {
      return;
    }
    _syncing = true;
    try {
      final isOnline = await NetworkService.isOnline();
      print('Network status: $isOnline');

      if (!isOnline) {
        print('Offline - skipping sync');
        _syncing = false;
        return;
      }

      final List<EventModel> queuedEvents =
          await dbHelper.getQueuedEvents();

      print('DEBUG: Found ${queuedEvents.length} queued events');
      
      if (queuedEvents.isEmpty) {
        print('No queued events to sync');
        _syncing = false;
        return;
      }

      print('Syncing ${queuedEvents.length} events to ${AppConstants.apiBaseUrl}${AppConstants.apiUploadEndpoint}');

      for (var event in queuedEvents) {
        print('Sending event: ${event.eventId}');
        await _sendEvent(event);
        await Future<void>.delayed(const Duration(milliseconds: 500));
      }
    } catch (e) {
      print('Sync error: $e');
    } finally {
      _syncing = false;
    }
  }

  Future<void> _sendEvent(EventModel event) async {
    int retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      try {
        print('DEBUG: Attempting to send event ${event.eventId} (attempt ${retryCount + 1}/$maxRetries)');
        
        final client = HttpClient();
        final uri = Uri.parse('${AppConstants.apiBaseUrl}${AppConstants.apiUploadEndpoint}');
        
        print('DEBUG: POST to $uri');
        
        final request = await client.postUrl(uri).timeout(
          const Duration(seconds: 10),
        );
        
        request.headers.contentType = ContentType.json;
        
        final jsonPayload = jsonEncode({
          'eventId': event.eventId,
          'type': event.type,
          'data': event.data,
          'timestampCreated': event.timestampCreated,
        });
        
        print('DEBUG: Payload: $jsonPayload');
        request.write(jsonPayload);
        
        final response = await request.close().timeout(
          const Duration(seconds: 10),
        );

        print('DEBUG: Response status: ${response.statusCode}');

        if (response.statusCode == 200 || response.statusCode == 201) {
          await dbHelper.updateEventStatus(
            eventId: event.eventId,
            status: AppConstants.statusSubmitted,
            timestampSubmitted: DateTime.now().toString(),
          );
          print('✓ Event synced: ${event.eventId}');
          return;
        } else {
          throw Exception('HTTP ${response.statusCode}');
        }
      } catch (e) {
        retryCount++;
        print('✗ Error sending ${event.eventId}: $e');
        if (retryCount < maxRetries) {
          await Future.delayed(Duration(seconds: 2 * retryCount));
        }
      }
    }

    print('✗ Failed to sync ${event.eventId} after $maxRetries retries');
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