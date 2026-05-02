import 'dart:async';

import '../models/event_model.dart';
import 'database_helper.dart';
import 'mqtt_client_service.dart';
import 'network_service.dart';

class SyncService {
  final DatabaseHelper dbHelper = DatabaseHelper.instance;
  final MqttClientService mqttService = MqttClientService();

  Timer? _timer;

  Future<void> start() async {
    await mqttService.connect();

    listenNetwork();

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
      }
    } catch (e) {
      print('Sync error: $e');
    }
  }

  Future<void> _sendEvent(EventModel event) async {
    int retryCount = 0;
    const maxRetries = 5;

    while (retryCount < maxRetries) {
      try {
        mqttService.publish(event.data);

        await dbHelper.updateEventStatus(
          eventId: event.eventId,
          status: 'SUBMITTED',
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