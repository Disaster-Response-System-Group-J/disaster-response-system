import 'enums.dart';

class AlertModel {
  final String id;
  final AlertType type;
  final IncidentSeverity severity;
  final String title;
  final String description;
  final String district;
  final bool isPublic;
  final bool isActive;
  final String? source;
  final DateTime createdAt;
  final DateTime? expiresAt;

  AlertModel({
    required this.id,
    required this.type,
    required this.severity,
    required this.title,
    required this.description,
    required this.district,
    required this.isPublic,
    required this.isActive,
    this.source,
    required this.createdAt,
    this.expiresAt,
  }) {
    if (title.isEmpty) {
      throw ArgumentError('Title cannot be empty');
    }
    if (description.isEmpty) {
      throw ArgumentError('Description cannot be empty');
    }
    if (district.isEmpty) {
      throw ArgumentError('District cannot be empty');
    }
  }

  Map<String, dynamic> toMap() {
    return {
      'alert_id': id,
      'type': type.toApiValue(),
      'severity': severity.toApiValue(),
      'title': title,
      'description': description,
      'district': district,
      'is_public': isPublic ? 1 : 0,
      'is_active': isActive ? 1 : 0,
      'source': source,
      'created_at': createdAt.toUtc().toIso8601String(),
      'expires_at': expiresAt?.toUtc().toIso8601String(),
    };
  }

  factory AlertModel.fromMap(Map<String, dynamic> map) {
    return AlertModel(
      id: (map['alert_id'] ?? map['id']).toString(),
      type: AlertType.fromApiValue((map['type'] ?? 'RISK_ALERT').toString()),
      severity: IncidentSeverity.fromApiValue((map['severity'] ?? 'LOW').toString()),
      title: (map['title'] ?? '').toString(),
      description: (map['description'] ?? '').toString(),
      district: (map['district'] ?? '').toString(),
      isPublic: _asBool(map['is_public'] ?? map['isPublic'], defaultValue: false),
      isActive: _asBool(map['is_active'] ?? map['isActive'], defaultValue: true),
      source: _asNullableString(map['source']),
      createdAt: _parseDateTime(map['created_at'] ?? map['createdAt']) ?? DateTime.now().toUtc(),
      expiresAt: _parseDateTime(map['expires_at'] ?? map['expiresAt']),
    );
  }

  AlertModel copyWith({
    String? id,
    AlertType? type,
    IncidentSeverity? severity,
    String? title,
    String? description,
    String? district,
    bool? isPublic,
    bool? isActive,
    String? source,
    DateTime? createdAt,
    DateTime? expiresAt,
  }) {
    return AlertModel(
      id: id ?? this.id,
      type: type ?? this.type,
      severity: severity ?? this.severity,
      title: title ?? this.title,
      description: description ?? this.description,
      district: district ?? this.district,
      isPublic: isPublic ?? this.isPublic,
      isActive: isActive ?? this.isActive,
      source: source ?? this.source,
      createdAt: createdAt ?? this.createdAt,
      expiresAt: expiresAt ?? this.expiresAt,
    );
  }

  static bool _asBool(dynamic value, {required bool defaultValue}) {
    if (value is bool) {
      return value;
    }
    if (value is int) {
      return value != 0;
    }
    if (value is String) {
      final normalized = value.toLowerCase();
      if (normalized == 'true' || normalized == '1') {
        return true;
      }
      if (normalized == 'false' || normalized == '0') {
        return false;
      }
    }
    return defaultValue;
  }

  static String? _asNullableString(dynamic value) {
    if (value == null) {
      return null;
    }
    final stringValue = value.toString();
    return stringValue.isEmpty ? null : stringValue;
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
    return 'AlertModel{id: $id, type: ${type.toApiValue()}, severity: ${severity.toApiValue()}, title: $title, district: $district, isPublic: $isPublic, isActive: $isActive, createdAt: ${createdAt.toUtc().toIso8601String()}}';
  }
}
