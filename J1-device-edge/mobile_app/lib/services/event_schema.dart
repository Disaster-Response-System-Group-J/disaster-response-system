import 'dart:convert';
import '../models/event_model.dart';

class EventSchema {
  static Map<String, dynamic> toMap(EventModel event) {
    return {
      'event_id': event.eventId,
      'type': event.type,
      'data': jsonDecode(event.data),
      'status': event.status,
      'timestamp_created': event.timestampCreated,
      'timestamp_submitted': event.timestampSubmitted,
    };
  }

  static String toJson(EventModel event) {
    return jsonEncode(toMap(event));
  }
}
