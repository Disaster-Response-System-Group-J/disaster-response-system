import 'dart:convert';

import 'enums.dart';

class IncomingReportModel {
  final String id;
  final ReportSource source;
  final DisasterType disasterType;
  final String district;
  final double latitude;
  final double longitude;
  final String description;
  final String? contact;
  final List<String> mediaUrls;
  final VerificationStatus verificationStatus;
  final DateTime createdAt;
  final String? sosId;
  final String? deviceId;
  final String? officerNotes;
  final String? reviewedById;
  final DateTime? reviewedAt;
  final String? incidentId;

  IncomingReportModel({
    required this.id,
    required this.source,
    required this.disasterType,
    required this.district,
    required this.latitude,
    required this.longitude,
    required this.description,
    this.contact,
    required List<String> mediaUrls,
    required this.verificationStatus,
    required this.createdAt,
    this.sosId,
    this.deviceId,
    this.officerNotes,
    this.reviewedById,
    this.reviewedAt,
    this.incidentId,
  }) : mediaUrls = List.unmodifiable(mediaUrls) {
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
  }

  Map<String, dynamic> toMap() {
    return {
      'report_id': id,
      'source': source.toApiValue(),
      'disaster_type': disasterType.toApiValue(),
      'district': district,
      'latitude': latitude,
      'longitude': longitude,
      'description': description,
      'contact': contact,
      'media_urls': jsonEncode(mediaUrls),
      'verification_status': verificationStatus.toApiValue(),
      'created_at': createdAt.toUtc().toIso8601String(),
      'sos_id': sosId,
      'device_id': deviceId,
      'officer_notes': officerNotes,
      'reviewed_by_id': reviewedById,
      'reviewed_at': reviewedAt?.toUtc().toIso8601String(),
      'incident_id': incidentId,
    };
  }

  factory IncomingReportModel.fromMap(Map<String, dynamic> map) {
    return IncomingReportModel(
      id: (map['report_id'] ?? map['id']).toString(),
      source: ReportSource.fromApiValue((map['source'] ?? 'J1_SOS_APP').toString()),
      disasterType: DisasterType.fromApiValue((map['disaster_type'] ?? 'OTHER').toString()),
      district: (map['district'] ?? '').toString(),
      latitude: _asDouble(map['latitude']),
      longitude: _asDouble(map['longitude']),
      description: (map['description'] ?? '').toString(),
      contact: _asNullableString(map['contact']),
      mediaUrls: _parseMediaUrls(map['media_urls'] ?? map['mediaUrls']),
      verificationStatus: VerificationStatus.fromApiValue(
        (map['verification_status'] ?? 'PENDING_REVIEW').toString(),
      ),
      createdAt: _parseDateTime(map['created_at'] ?? map['createdAt']) ?? DateTime.now().toUtc(),
      sosId: _asNullableString(map['sos_id'] ?? map['sosId']),
      deviceId: _asNullableString(map['device_id'] ?? map['deviceId']),
      officerNotes: _asNullableString(map['officer_notes'] ?? map['officerNotes']),
      reviewedById: _asNullableString(map['reviewed_by_id'] ?? map['reviewedById']),
      reviewedAt: _parseDateTime(map['reviewed_at'] ?? map['reviewedAt']),
      incidentId: _asNullableString(map['incident_id'] ?? map['incidentId']),
    );
  }

  IncomingReportModel copyWith({
    String? id,
    ReportSource? source,
    DisasterType? disasterType,
    String? district,
    double? latitude,
    double? longitude,
    String? description,
    String? contact,
    List<String>? mediaUrls,
    VerificationStatus? verificationStatus,
    DateTime? createdAt,
    String? sosId,
    String? deviceId,
    String? officerNotes,
    String? reviewedById,
    DateTime? reviewedAt,
    String? incidentId,
  }) {
    return IncomingReportModel(
      id: id ?? this.id,
      source: source ?? this.source,
      disasterType: disasterType ?? this.disasterType,
      district: district ?? this.district,
      latitude: latitude ?? this.latitude,
      longitude: longitude ?? this.longitude,
      description: description ?? this.description,
      contact: contact ?? this.contact,
      mediaUrls: mediaUrls ?? this.mediaUrls,
      verificationStatus: verificationStatus ?? this.verificationStatus,
      createdAt: createdAt ?? this.createdAt,
      sosId: sosId ?? this.sosId,
      deviceId: deviceId ?? this.deviceId,
      officerNotes: officerNotes ?? this.officerNotes,
      reviewedById: reviewedById ?? this.reviewedById,
      reviewedAt: reviewedAt ?? this.reviewedAt,
      incidentId: incidentId ?? this.incidentId,
    );
  }

  static List<String> _parseMediaUrls(dynamic value) {
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
    return 'IncomingReportModel{id: $id, source: ${source.toApiValue()}, disasterType: ${disasterType.toApiValue()}, district: $district, latitude: $latitude, longitude: $longitude, verificationStatus: ${verificationStatus.toApiValue()}, createdAt: ${createdAt.toUtc().toIso8601String()}}';
  }
}
