import 'dart:convert';

import 'event_model.dart';

class RequestModel {
  final int? id;
  final String type;
  final String description;
  final String location;
  final String status; // QUEUED or SUBMITTED

  RequestModel({
    this.id,
    required this.type,
    required this.description,
    required this.location,
    required this.status,
  });

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'type': type,
      'description': description,
      'location': location,
      'status': status,
    };
  }

  factory RequestModel.fromMap(Map<String, dynamic> map) {
    return RequestModel(
      id: map['id'],
      type: map['type'],
      description: map['description'],
      location: map['location'],
      status: map['status'],
    );
  }

  factory RequestModel.fromEvent(EventModel event) {
    String type = event.type;
    String description = event.data;
    String location = '';

    try {
      final decoded = jsonDecode(event.data);
      if (decoded is Map<String, dynamic>) {
        type = (decoded['request_type'] ?? decoded['data_type'] ?? event.type)
            .toString();
        description = (decoded['description'] ?? event.data).toString();
        location = (decoded['location'] ?? '').toString();
      }
    } catch (_) {
    }

    return RequestModel(
      type: type,
      description: description,
      location: location,
      status: event.status,
    );
  }
}