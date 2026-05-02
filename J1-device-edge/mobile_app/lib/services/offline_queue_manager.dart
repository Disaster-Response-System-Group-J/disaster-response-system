import 'package:uuid/uuid.dart';
import 'package:intl/intl.dart';
import 'dart:convert';

import '../models/event_model.dart';
import 'database_helper.dart';
import 'network_service.dart';

class OfflineQueueManager {
  final DatabaseHelper dbHelper = DatabaseHelper.instance;

  Future<void> addEvent(Map<String, dynamic> data, String type) async {
    final eventId = const Uuid().v4();

    final event = EventModel(
      eventId: eventId,
      type: type,
      data: jsonEncode(data),
      status: 'QUEUED',
      timestampCreated: DateFormat("yyyy-MM-ddTHH:mm:ss'Z'")
          .format(DateTime.now().toUtc()),
      timestampSubmitted: null,
    );

    await dbHelper.saveEvent(event);

    print('Event queued: $eventId');

    final online = await NetworkService.isOnline();

    if (online) {
      await syncQueuedEvents();
    }
  }

  Future<void> syncQueuedEvents() async {
    final queuedEvents = await dbHelper.getQueuedEvents();

    if (queuedEvents.isEmpty) {
      print('No queued events to sync');
      return;
    }

    for (final event in queuedEvents) {
      try {
        await Future.delayed(const Duration(seconds: 1));

        await dbHelper.updateEventStatus(
          eventId: event.eventId,
          status: 'SUBMITTED',
          timestampSubmitted: DateFormat("yyyy-MM-ddTHH:mm:ss'Z'")
              .format(DateTime.now().toUtc()),
        );

        print('Event submitted: ${event.eventId}');
      } catch (e) {
        print('Failed to sync event ${event.eventId}: $e');
      }
    }
  }

  Future<int> getQueueCount() async {
    return await dbHelper.getQueueCount();
  }

  Future<List<EventModel>> getAllEvents() async {
    return await dbHelper.getAllEvents();
  }
}