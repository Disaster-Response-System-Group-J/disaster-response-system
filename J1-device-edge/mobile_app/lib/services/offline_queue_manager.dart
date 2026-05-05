import 'package:uuid/uuid.dart';
import 'package:intl/intl.dart';
import 'dart:convert';

import '../models/event_model.dart';
import '../utills/constants.dart';
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
      status: AppConstants.statusQueued,
      timestampCreated: DateFormat("yyyy-MM-ddTHH:mm:ss'Z'")
          .format(DateTime.now().toUtc()),
      timestampSubmitted: null,
    );

    await dbHelper.saveEvent(event);

    print('Event queued: $eventId');

    // Kick a connection check so SyncService can auto-flush when the broker is reachable.
    await NetworkService.checkConnection();
  }

  Future<int> getQueueCount() async {
    return await dbHelper.getQueueCount();
  }

  Future<List<EventModel>> getAllEvents() async {
    return await dbHelper.getAllEvents();
  }
}