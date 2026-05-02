class EventModel {
  final String eventId;
  final String type;
  final String data;
  final String status;
  final String timestampCreated;
  final String? timestampSubmitted;

  EventModel({
    required this.eventId,
    required this.type,
    required this.data,
    required this.status,
    required this.timestampCreated,
    this.timestampSubmitted,
  });

  Map<String, dynamic> toMap() {
    return {
      'event_id': eventId,
      'type': type,
      'data': data,
      'status': status,
      'timestamp_created': timestampCreated,
      'timestamp_submitted': timestampSubmitted,
    };
  }

  factory EventModel.fromMap(Map<String, dynamic> map) {
    return EventModel(
      eventId: map['event_id'],
      type: map['type'],
      data: map['data'],
      status: map['status'],
      timestampCreated: map['timestamp_created'],
      timestampSubmitted: map['timestamp_submitted'],
    );
  }
}