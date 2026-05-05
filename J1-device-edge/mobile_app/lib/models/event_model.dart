import 'dart:convert';

class EventModel {
  final String eventId;
  final String type;
  final String data; // Will be stored in 'payload' column
  final String status;
  final String createdAt; // Maps to 'created_at' column
  final String? submittedAt; // Maps to 'submitted_at' column
  final String userId;
  final String deviceId;
  final int syncAttempts;
  final String? lastSyncError;
  final Map<String, dynamic> metadata;
  final String eventVersion; // Maps to 'event_version' column
  final String? lastSyncAt; // Maps to 'last_sync_at' column

  EventModel({
    required this.eventId,
    required this.type,
    required this.data,
    required this.status,
    required this.createdAt,
    this.submittedAt,
    required this.userId,
    required this.deviceId,
    this.syncAttempts = 0,
    this.lastSyncError,
    required this.metadata,
    this.eventVersion = '1.0',
    this.lastSyncAt,
  });

  Map<String, dynamic> toMap() {
    return {
      'event_id': eventId,
      'event_type': type,
      'event_version': eventVersion,
      'user_id': userId,
      'device_id': deviceId,
      'payload': data,
      'metadata': jsonEncode(metadata),
      'status': status,
      'sync_attempts': syncAttempts,
      'last_sync_error': lastSyncError,
      'last_sync_at': lastSyncAt,
      'created_at': createdAt,
      'submitted_at': submittedAt,
    };
  }

  factory EventModel.fromMap(Map<String, dynamic> map) {
    return EventModel(
      eventId: map['event_id'] ?? '',
      type: map['event_type'] ?? '',
      data: map['payload'] ?? '',
      status: map['status'] ?? '',
      createdAt: map['created_at'] ?? '',
      submittedAt: map['submitted_at'],
      userId: map['user_id'] ?? '',
      deviceId: map['device_id'] ?? '',
      syncAttempts: map['sync_attempts'] ?? 0,
      lastSyncError: map['last_sync_error'],
      metadata: map['metadata'] != null ? jsonDecode(map['metadata']) : {},
      eventVersion: map['event_version'] ?? '1.0',
      lastSyncAt: map['last_sync_at'],
    );
  }
}