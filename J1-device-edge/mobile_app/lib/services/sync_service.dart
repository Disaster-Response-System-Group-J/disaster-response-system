import 'dart:async';

import '../models/event_model.dart';
import '../utills/constants.dart';
import 'database_helper.dart';
import 'mqtt_client_service.dart';
import 'network_service.dart';

class SyncService {
  final DatabaseHelper dbHelper = DatabaseHelper.instance;
  final MqttClientService mqttService = MqttClientService();

  Timer? _timer;
  bool _syncing = false;

  Future<void> start() async {
    listenNetwork();

    // Ensure network polling is running.
    NetworkService.startListening();
    unawaited(NetworkService.checkConnection());

    // Connect in a bounded way so startup can't hang on MQTT.
    await mqttService.connect(timeout: const Duration(seconds: 5));

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

      if (!isOnline) {
        print('Offline - skipping sync');
        return;
      }

      final List<EventModel> queuedEvents =
          await dbHelper.getQueuedEvents();

      if (queuedEvents.isEmpty) {
        print('No queued events');
        return;
      }

      print('Syncing ${queuedEvents.length} events');

      for (var event in queuedEvents) {
        await _sendEvent(event);
        await Future<void>.delayed(Duration.zero);
      }
    } catch (e) {
      print('Sync error: $e');
    } finally {
      _syncing = false;
    }
  }

  Future<void> _sendEvent(EventModel event) async {
    int retryCount = 0;
    const maxRetries = 5;

    while (retryCount < maxRetries) {
      try {
        if (!mqttService.isConnected) {
          await mqttService.connect(timeout: const Duration(seconds: 5));
        }

        if (!mqttService.isConnected) {
          throw Exception('MQTT not connected');
        }

        mqttService.publish(event.data);

        await dbHelper.updateEventStatus(
          eventId: event.eventId,
          status: AppConstants.statusSubmitted,
          timestampSubmitted: DateTime.now().toString(),
        );

        print('Event synced: ${event.eventId}');
        return;
      } catch (e) {
        retryCount++;
        print('Retry $retryCount for ${event.eventId}');
        await Future.delayed(Duration(seconds: 2 * retryCount));
      }
    }

    print('Failed after retries: ${event.eventId}');
  }

  void stop() {
    _timer?.cancel();
    print('Sync service stopped');
  }
}