import 'dart:convert';

import 'enums.dart';

class ConfirmedIncidentModel {
  final String id;
  final String title;
  final DisasterType disasterType;
  final String district;
  final IncidentSeverity severity;
  final IncidentStatus status;
  final double latitude;
  final double longitude;
  final String description;
  final bool publicVisibility;
  final int affectedPeople;
  final DateTime createdAt;
  final DateTime updatedAt;
  final List<String> sourceReportIds;
  final List<String> assignedResourceIds;

  ConfirmedIncidentModel({
    required this.id,
    required this.title,
    required this.disasterType,
    required this.district,
    required this.severity,
    required this.status,
    required this.latitude,
    required this.longitude,
    required this.description,
    required this.publicVisibility,
    required this.affectedPeople,
    required this.createdAt,
    required this.updatedAt,
    List<String>? sourceReportIds,
    List<String>? assignedResourceIds,
  })  : sourceReportIds = List.unmodifiable(sourceReportIds ?? const <String>[]),
        assignedResourceIds = List.unmodifiable(assignedResourceIds ?? const <String>[]) {
    if (title.isEmpty) {
      throw ArgumentError('Title cannot be empty');
    }
    if (district.isEmpty) {
      throw ArgumentError('District cannot be empty');
    }
    if (description.isEmpty) {
      throw ArgumentError('Description cannot be empty');
    }
    if (latitude < -90 || latitude > 90) {
      throw ArgumentError('Latitude must be between -90 and 90');
    }
    if (longitude < -180 || longitude > 180) {
      throw ArgumentError('Longitude must be between -180 and 180');
    }
    if (affectedPeople < 0) {
      throw ArgumentError('Affected people cannot be negative');
    }
  }

  Map<String, dynamic> toMap() {
    return {
      'incident_id': id,
      'title': title,
      'disaster_type': disasterType.toApiValue(),
      'district': district,
      'severity': severity.toApiValue(),
      'status': status.toApiValue(),
      'latitude': latitude,
      'longitude': longitude,
      'description': description,
      'public_visibility': publicVisibility ? 1 : 0,
      'affected_people': affectedPeople,
      'created_at': createdAt.toUtc().toIso8601String(),
      'updated_at': updatedAt.toUtc().toIso8601String(),
      'source_report_ids': jsonEncode(sourceReportIds),
      'assigned_resource_ids': jsonEncode(assignedResourceIds),
    };
  }

  factory ConfirmedIncidentModel.fromMap(Map<String, dynamic> map) {
    return ConfirmedIncidentModel(
      id: (map['incident_id'] ?? map['id']).toString(),
      title: (map['title'] ?? '').toString(),
      disasterType: DisasterType.fromApiValue((map['disaster_type'] ?? 'OTHER').toString()),
      district: (map['district'] ?? '').toString(),
      severity: IncidentSeverity.fromApiValue((map['severity'] ?? 'LOW').toString()),
      status: IncidentStatus.fromApiValue((map['status'] ?? 'ACTIVE').toString()),
      latitude: _asDouble(map['latitude']),
      longitude: _asDouble(map['longitude']),
      description: (map['description'] ?? '').toString(),
      publicVisibility: _asBool(map['public_visibility'] ?? map['publicVisibility'], defaultValue: true),
      affectedPeople: _asInt(map['affected_people'] ?? map['affectedPeople']),
      createdAt: _parseDateTime(map['created_at'] ?? map['createdAt']) ?? DateTime.now().toUtc(),
      updatedAt: _parseDateTime(map['updated_at'] ?? map['updatedAt']) ?? DateTime.now().toUtc(),
      sourceReportIds: _parseStringList(map['source_report_ids'] ?? map['sourceReportIds']),
      assignedResourceIds: _parseStringList(map['assigned_resource_ids'] ?? map['assignedResourceIds']),
    );
  }

  ConfirmedIncidentModel copyWith({
    String? id,
    String? title,
    DisasterType? disasterType,
    String? district,
    IncidentSeverity? severity,
    IncidentStatus? status,
    double? latitude,
    double? longitude,
    String? description,
    bool? publicVisibility,
    int? affectedPeople,
    DateTime? createdAt,
    DateTime? updatedAt,
    List<String>? sourceReportIds,
    List<String>? assignedResourceIds,
  }) {
    return ConfirmedIncidentModel(
      id: id ?? this.id,
      title: title ?? this.title,
      disasterType: disasterType ?? this.disasterType,
      district: district ?? this.district,
      severity: severity ?? this.severity,
      status: status ?? this.status,
      latitude: latitude ?? this.latitude,
      longitude: longitude ?? this.longitude,
      description: description ?? this.description,
      publicVisibility: publicVisibility ?? this.publicVisibility,
      affectedPeople: affectedPeople ?? this.affectedPeople,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      sourceReportIds: sourceReportIds ?? this.sourceReportIds,
      assignedResourceIds: assignedResourceIds ?? this.assignedResourceIds,
    );
  }

  static List<String> _parseStringList(dynamic value) {
    if (value == null) {
      return <String>[];
    }

    if (value is List) {
      return value.map((item) => item.toString()).where((item) => item.isNotEmpty).toList();
    }

    if (value is String && value.isNotEmpty) {
      try {
        final decoded = jsonDecode(value);
        if (decoded is List) {
          return decoded.map((item) => item.toString()).where((item) => item.isNotEmpty).toList();
        }
      } catch (_) {
        return value
            .split(',')
            .map((item) => item.trim())
            .where((item) => item.isNotEmpty)
            .toList();
      }
    }

    return <String>[];
  }

  static double _asDouble(dynamic value) {
    if (value is double) {
      return value;
    }
    if (value is int) {
      return value.toDouble();
    }
    if (value is String) {
      return double.tryParse(value) ?? 0.0;
    }
    return 0.0;
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
    return 'ConfirmedIncidentModel{id: $id, title: $title, disasterType: ${disasterType.toApiValue()}, district: $district, severity: ${severity.toApiValue()}, status: ${status.toApiValue()}, affectedPeople: $affectedPeople, createdAt: ${createdAt.toUtc().toIso8601String()}, updatedAt: ${updatedAt.toUtc().toIso8601String()}}';
  }
}
