import 'dart:convert';
import '../models/event_model.dart';

class EventSchema {
  static Map<String, dynamic> toMap(EventModel event) {
    return {
      'event_id': event.eventId,
      'type': event.type,
      'payload': jsonDecode(event.data),
      'status': event.status,
      'created_at': event.createdAt,
      'submitted_at': event.submittedAt,
      'user_id': event.userId,
      'device_id': event.deviceId,
      'event_version': event.eventVersion,
      'metadata': event.metadata,
    };
  }

  static String toJson(EventModel event) {
    return jsonEncode(toMap(event));
  }
}
