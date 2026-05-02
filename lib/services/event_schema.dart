import 'dart:convert';
import '../models/event_model.dart';

class EventSchema {
  static String toJson(EventModel event) {
    return jsonEncode({
      'event_id': event.eventId,
      'type': event.type,
      'data': jsonDecode(event.data),
      'timestamp': event.timestampCreated,
    });
  }
}