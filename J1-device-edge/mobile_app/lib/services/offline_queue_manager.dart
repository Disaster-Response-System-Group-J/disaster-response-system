import 'package:uuid/uuid.dart';
import 'package:intl/intl.dart';
import 'dart:convert';

import '../models/event_model.dart';
import 'database_helper.dart';

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
    );

    await dbHelper.saveEvent(event);

    print('Event queued: $eventId');
  }
}