import 'dart:async';

import '../models/event_model.dart';
import 'database_helper.dart';
import 'mqtt_client_service.dart';

class SyncService {
  final DatabaseHelper dbHelper = DatabaseHelper.instance;
  final MqttClientService mqttService = MqttClientService();

  Timer? _timer;

  Future<void> start() async {
    await mqttService.connect();

    // Run every 10 seconds
    _timer = Timer.periodic(const Duration(seconds: 10), (timer) {
      syncQueuedEvents();
    });
  }

  Future<void> syncQueuedEvents() async {
    try {
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
    try {
      final message = event.data;

      mqttService.publish(message);

      // 👉 For now assume success (later we handle ACK properly)
      await dbHelper.updateEventStatus(
        eventId: event.eventId,
        status: 'SUBMITTED',
        timestampSubmitted: DateTime.now().toString(),
      );

      print('Event synced: ${event.eventId}');
    } catch (e) {
      print('Failed to send event: ${event.eventId}');
    }
  }

  void stop() {
    _timer?.cancel();
  }
}