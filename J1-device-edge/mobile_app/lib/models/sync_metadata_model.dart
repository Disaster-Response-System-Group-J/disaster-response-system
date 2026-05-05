class SyncMetadataModel {
  static const String recordTypeReport = 'report';
  static const String recordTypeIncident = 'incident';
  static const String recordTypeResource = 'resource';
  static const String recordTypeAlert = 'alert';
  static const String recordTypeUser = 'user';

  static const String syncStatusPending = 'pending';
  static const String syncStatusUploading = 'uploading';
  static const String syncStatusUploaded = 'uploaded';
  static const String syncStatusFailed = 'failed';

  final String recordId;
  final String recordType;
  final String syncStatus;
  final DateTime? lastSyncAttempt;
  final String? syncErrorMessage;
  final int retryCount;
  final DateTime createdAt;

  SyncMetadataModel({
    required this.recordId,
    required this.recordType,
    required this.syncStatus,
    this.lastSyncAttempt,
    this.syncErrorMessage,
    required this.retryCount,
    required this.createdAt,
  }) {
    if (recordId.isEmpty) {
      throw ArgumentError('Record ID cannot be empty');
    }
    if (!_isValidRecordType(recordType)) {
      throw ArgumentError('Invalid record type: $recordType');
    }
    if (!_isValidSyncStatus(syncStatus)) {
      throw ArgumentError('Invalid sync status: $syncStatus');
    }
    if (retryCount < 0) {
      throw ArgumentError('Retry count cannot be negative');
    }
  }

  Map<String, dynamic> toMap() {
    return {
      'record_id': recordId,
      'record_type': recordType,
      'sync_status': syncStatus,
      'last_sync_attempt': lastSyncAttempt?.toUtc().toIso8601String(),
      'sync_error_message': syncErrorMessage,
      'retry_count': retryCount,
      'created_at': createdAt.toUtc().toIso8601String(),
    };
  }

  factory SyncMetadataModel.fromMap(Map<String, dynamic> map) {
    return SyncMetadataModel(
      recordId: (map['record_id'] ?? map['recordId']).toString(),
      recordType: (map['record_type'] ?? map['recordType'] ?? recordTypeReport).toString(),
      syncStatus: (map['sync_status'] ?? map['syncStatus'] ?? syncStatusPending).toString(),
      lastSyncAttempt: _parseDateTime(map['last_sync_attempt'] ?? map['lastSyncAttempt']),
      syncErrorMessage: _asNullableString(map['sync_error_message'] ?? map['syncErrorMessage']),
      retryCount: _asInt(map['retry_count'] ?? map['retryCount']),
      createdAt: _parseDateTime(map['created_at'] ?? map['createdAt']) ?? DateTime.now().toUtc(),
    );
  }

  SyncMetadataModel copyWith({
    String? recordId,
    String? recordType,
    String? syncStatus,
    DateTime? lastSyncAttempt,
    String? syncErrorMessage,
    int? retryCount,
    DateTime? createdAt,
  }) {
    return SyncMetadataModel(
      recordId: recordId ?? this.recordId,
      recordType: recordType ?? this.recordType,
      syncStatus: syncStatus ?? this.syncStatus,
      lastSyncAttempt: lastSyncAttempt ?? this.lastSyncAttempt,
      syncErrorMessage: syncErrorMessage ?? this.syncErrorMessage,
      retryCount: retryCount ?? this.retryCount,
      createdAt: createdAt ?? this.createdAt,
    );
  }

  bool shouldRetry({
    DateTime? now,
    Duration retryDelay = const Duration(minutes: 5),
    int maxRetries = 3,
  }) {
    if (retryCount >= maxRetries) {
      return false;
    }

    if (syncStatus == syncStatusUploaded) {
      return false;
    }

    if (lastSyncAttempt == null) {
      return true;
    }

    final currentTime = now?.toUtc() ?? DateTime.now().toUtc();
    return currentTime.difference(lastSyncAttempt!.toUtc()) >= retryDelay;
  }

  bool isPending() => syncStatus == syncStatusPending;
  bool isUploading() => syncStatus == syncStatusUploading;
  bool isUploaded() => syncStatus == syncStatusUploaded;
  bool isFailed() => syncStatus == syncStatusFailed;

  static bool _isValidRecordType(String value) {
    return const {
      recordTypeReport,
      recordTypeIncident,
      recordTypeResource,
      recordTypeAlert,
      recordTypeUser,
    }.contains(value);
  }

  static bool _isValidSyncStatus(String value) {
    return const {
      syncStatusPending,
      syncStatusUploading,
      syncStatusUploaded,
      syncStatusFailed,
    }.contains(value);
  }

  static String? _asNullableString(dynamic value) {
    if (value == null) {
      return null;
    }
    final stringValue = value.toString();
    return stringValue.isEmpty ? null : stringValue;
  }

  static int _asInt(dynamic value) {
    if (value is int) {
      return value;
    }
    if (value is double) {
      return value.round();
    }
    if (value is String) {
      return int.tryParse(value) ?? 0;
    }
    return 0;
  }

  static DateTime? _parseDateTime(dynamic value) {
    if (value == null) {
      return null;
    }
    if (value is DateTime) {
      return value.toUtc();
    }
    final stringValue = value.toString();
    if (stringValue.isEmpty) {
      return null;
    }
    return DateTime.parse(stringValue).toUtc();
  }

  @override
  String toString() {
    return 'SyncMetadataModel{recordId: $recordId, recordType: $recordType, syncStatus: $syncStatus, retryCount: $retryCount, lastSyncAttempt: ${lastSyncAttempt?.toUtc().toIso8601String()}, createdAt: ${createdAt.toUtc().toIso8601String()}}';
  }
}
