import 'dart:convert';

import 'package:intl/intl.dart';
import 'package:uuid/uuid.dart';

import '../models/event_model.dart';
import '../utills/constants.dart';
import 'database_helper.dart';


class Day1DatabaseTest {
  static Future<void> runTest() async {
    final eventId = const Uuid().v4();

    final testData = {
      'request_type': 'flood_rescue',
      'description': 'Water level rising near house',
      'people_count': 4,
      'location': 'Jaffna',
    };

    final event = EventModel(
      eventId: eventId,
      type: 'HELP_REQUEST',
      data: jsonEncode(testData),
      status: AppConstants.statusQueued,
      timestampCreated: DateFormat("yyyy-MM-ddTHH:mm:ss'Z'")
          .format(DateTime.now().toUtc()),
    );

    await DatabaseHelper.instance.saveEvent(event);

    final queueCount = await DatabaseHelper.instance.getQueueCount();
    final queuedEvents = await DatabaseHelper.instance.getQueuedEvents();

    print('Day 1 database test completed');
    print('Queue count: $queueCount');
    print('First queued event ID: ${queuedEvents.first.eventId}');
  }
}