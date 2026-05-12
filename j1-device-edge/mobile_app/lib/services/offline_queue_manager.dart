import 'package:uuid/uuid.dart';
import 'package:intl/intl.dart';
import 'dart:convert';

import 'auth_service.dart';
import '../models/event_model.dart';
import '../utills/constants.dart';
import 'database_helper.dart';
import 'network_service.dart';

class OfflineQueueManager {
  final DatabaseHelper dbHelper = DatabaseHelper.instance;

  Future<void> addEvent(
    Map<String, dynamic> data,
    String type, {
    String? userId,
    String? deviceId,
  }) async {
    final activeUser = AuthService.instance.currentUser;
    final resolvedUserId = userId ?? activeUser?.id;
    if (resolvedUserId == null || resolvedUserId.isEmpty) {
      throw Exception('No active user session found');
    }

    final resolvedDeviceId = deviceId ?? await dbHelper.getDeviceId();
    final payloadJson = jsonEncode(data);
    final existing = await dbHelper.findEventBySignature(
      eventType: type,
      userId: resolvedUserId,
      payload: payloadJson,
    );
    if (existing != null) {
      print('Duplicate event skipped: ${existing.eventId}');
      return;
    }

    final eventId = const Uuid().v4();
    final now = DateTime.now().toUtc();

    final event = EventModel(
      eventId: eventId,
      type: type,
      data: payloadJson,
      status: AppConstants.statusQueued,
      createdAt: DateFormat("yyyy-MM-ddTHH:mm:ss'Z'").format(now),
      submittedAt: null,
      userId: resolvedUserId,
      deviceId: resolvedDeviceId,
      metadata: {
        'appVersion': '1.0.0',
        'osVersion': 'Mobile',
        'networkType': 'offline',
      },
      eventVersion: '1.0',
      lastSyncAt: null,
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
