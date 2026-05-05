import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;

import '../models/event_model.dart';
import '../utills/constants.dart';
import 'database_helper.dart';
import 'network_service.dart';

/// Production-grade sync service for offline-first event synchronization.
/// 
/// Architecture:
/// - SQLite → Local event log (source of truth for mobile)
/// - HTTP/Idempotency → Backend API (with retry & deduplication)
/// - Kafka → Backend event stream (source of truth for system)
/// - PostgreSQL → Derived read model
class SyncService {
  final DatabaseHelper dbHelper = DatabaseHelper.instance;
  
  Timer? _timer;
  bool _syncing = false;
  
  // Sync configuration
  static const int maxRetries = 5;
  static const Duration retryBackoff = Duration(seconds: 2);
  static const Duration syncInterval = Duration(seconds: 30);

  Future<void> start() async {
    print('🚀 SyncService starting...');
    listenNetwork();

    // Ensure network polling is running.
    NetworkService.startListening();
    unawaited(NetworkService.checkConnection());

    // Attempt an initial flush without blocking startup flows.
    unawaited(syncQueuedEvents());

    // Periodic sync attempt
    _timer = Timer.periodic(syncInterval, (timer) {
      syncQueuedEvents();
    });
    
    print('✓ SyncService started');
  }

  void listenNetwork() {
    NetworkService.onNetworkChange.listen((isOnline) {
      if (isOnline) {
        print('✓ Network available, triggering sync');
        syncQueuedEvents();
      } else {
        print('⚠ Offline mode - events queued locally');
      }
    });
  }

  Future<void> syncQueuedEvents() async {
    if (_syncing) {
      print('ℹ Sync already in progress, skipping');
      return;
    }
    
    _syncing = true;
    
    try {
      final isOnline = await NetworkService.isOnline();
      if (!isOnline) {
        print('⚠ Offline - sync postponed');
        _syncing = false;
        return;
      }

      final List<EventModel> queuedEvents = await dbHelper.getQueuedEvents();
      
      if (queuedEvents.isEmpty) {
        print('ℹ No queued events to sync');
        _syncing = false;
        return;
      }

      print('🔄 Syncing ${queuedEvents.length} events...');

      for (var event in queuedEvents) {
        await _sendEventWithRetry(event);
        // Small delay to avoid overwhelming network
        await Future.delayed(const Duration(milliseconds: 100));
      }
      
      print('✓ Sync cycle complete');
    } catch (e) {
      print('✗ Sync error: $e');
    } finally {
      _syncing = false;
    }
  }

  /// Send event with exponential backoff retry logic.
  Future<void> _sendEventWithRetry(EventModel event) async {
    for (int attempt = 0; attempt < maxRetries; attempt++) {
      try {
        final response = await _postEvent(event);
        
        if (response.statusCode == 200 || response.statusCode == 202) {
          // 202 Accepted = server enqueued to Kafka
          await dbHelper.updateEventStatus(
            eventId: event.eventId,
            status: 'SUBMITTED',
            submittedAt: DateTime.now().toIso8601String(),
            syncAttempts: attempt + 1,
          );
          print('✓ Event synced: ${event.eventId}');
          return;
        } else if (response.statusCode == 409) {
          // 409 Conflict = duplicate (already processed)
          await dbHelper.updateEventStatus(
            eventId: event.eventId,
            status: 'DUPLICATE',
            submittedAt: DateTime.now().toIso8601String(),
            syncAttempts: attempt + 1,
          );
          print('⚠ Duplicate event: ${event.eventId}');
          return;
        } else {
          throw Exception('HTTP ${response.statusCode}: ${response.body}');
        }
      } catch (e) {
        print('✗ Attempt ${attempt + 1}/$maxRetries failed for ${event.eventId}: $e');
        
        // Track sync attempt and error
        await dbHelper.incrementSyncAttempts(event.eventId, error: e.toString());
        
        if (attempt < maxRetries - 1) {
          final backoffMs = (retryBackoff.inMilliseconds * (attempt + 1)).toInt();
          print('⏳ Retrying in ${backoffMs}ms...');
          await Future.delayed(Duration(milliseconds: backoffMs));
        }
      }
    }

    print('✗ Failed to sync ${event.eventId} after $maxRetries attempts');
  }

  /// POST event to backend API with idempotency headers.
  Future<http.Response> _postEvent(EventModel event) async {
    final uri = Uri.parse('${AppConstants.apiBaseUrl}${AppConstants.apiUploadEndpoint}');
    
    final payload = {
      'eventId': event.eventId,
      'eventType': event.type,
      'eventVersion': '1.0',
      'timestamp': DateTime.now().toIso8601String(),
      'userId': event.userId ?? 'unknown',
      'deviceId': event.deviceId ?? 'unknown',
      'payload': jsonDecode(event.data),
      'metadata': {
        'appVersion': '1.0.0',
        'osVersion': Platform.version,
        'networkType': 'mobile',
      },
    };

    print('DEBUG: POST → $uri');
    print('DEBUG: Idempotency-Key: ${event.eventId}');
    
    return await http.post(
      uri,
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': event.eventId, // ← CRITICAL for deduplication
      },
      body: jsonEncode(payload),
    ).timeout(
      const Duration(seconds: 15),
      onTimeout: () => http.Response('Request timeout', 408),
    );
  }

  void stop() {
    _timer?.cancel();
    print('Sync service stopped');
  }

  /// Debug helper: print database state
  Future<void> debugDatabaseStatus() async {
    try {
      final allEvents = await dbHelper.getAllEvents();
      final queuedEvents = await dbHelper.getQueuedEvents();
      final submittedEvents = await dbHelper.getSubmittedEvents();
      
      print('');
      print('╔════════════════════════════════════════╗');
      print('║        DATABASE STATUS DEBUG           ║');
      print('╚════════════════════════════════════════╝');
      print('Total events:     ${allEvents.length}');
      print('Queued events:    ${queuedEvents.length}');
      print('Submitted events: ${submittedEvents.length}');
      print('');
      
      for (var event in allEvents) {
        print('ID: ${event.eventId.substring(0, 8)}...');
        print('   Type:     ${event.type}');
        print('   Status:   ${event.status}');
        print('   Attempts: ${event.syncAttempts}');
        if (event.lastSyncError != null) {
          print('   Error:    ${event.lastSyncError}');
        }
        print('');
      }
    } catch (e) {
      print('❌ Debug error: $e');
    }
  }
}
