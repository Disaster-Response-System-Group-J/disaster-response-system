import 'enums.dart';

class ResourceModel {
  final String id;
  final ResourceType type;
  final String name;
  final String district;
  final ResourceStatus status;
  final double? latitude;
  final double? longitude;
  final int? capacity;
  final int? currentLoad;
  final DateTime lastUpdated;
  final String? incidentId;

  ResourceModel({
    required this.id,
    required this.type,
    required this.name,
    required this.district,
    required this.status,
    this.latitude,
    this.longitude,
    this.capacity,
    this.currentLoad,
    required this.lastUpdated,
    this.incidentId,
  }) {
    if (name.isEmpty) {
      throw ArgumentError('Name cannot be empty');
    }
    if (district.isEmpty) {
      throw ArgumentError('District cannot be empty');
    }
    if (latitude != null && (latitude! < -90 || latitude! > 90)) {
      throw ArgumentError('Latitude must be between -90 and 90');
    }
    if (longitude != null && (longitude! < -180 || longitude! > 180)) {
      throw ArgumentError('Longitude must be between -180 and 180');
    }
    if (capacity != null && capacity! < 0) {
      throw ArgumentError('Capacity cannot be negative');
    }
    if (currentLoad != null && currentLoad! < 0) {
      throw ArgumentError('Current load cannot be negative');
    }
  }

  Map<String, dynamic> toMap() {
    return {
      'resource_id': id,
      'type': type.toApiValue(),
      'name': name,
      'district': district,
      'status': status.toApiValue(),
      'latitude': latitude,
      'longitude': longitude,
      'capacity': capacity,
      'current_load': currentLoad,
      'last_updated': lastUpdated.toUtc().toIso8601String(),
      'incident_id': incidentId,
    };
  }

  factory ResourceModel.fromMap(Map<String, dynamic> map) {
    return ResourceModel(
      id: (map['resource_id'] ?? map['id']).toString(),
      type: ResourceType.fromApiValue((map['type'] ?? 'RESCUE_TEAM').toString()),
      name: (map['name'] ?? '').toString(),
      district: (map['district'] ?? '').toString(),
      status: ResourceStatus.fromApiValue((map['status'] ?? 'AVAILABLE').toString()),
      latitude: _asNullableDouble(map['latitude']),
      longitude: _asNullableDouble(map['longitude']),
      capacity: _asNullableInt(map['capacity']),
      currentLoad: _asNullableInt(map['current_load'] ?? map['currentLoad']),
      lastUpdated: _parseDateTime(map['last_updated'] ?? map['lastUpdated']) ?? DateTime.now().toUtc(),
      incidentId: _asNullableString(map['incident_id'] ?? map['incidentId']),
    );
  }

  ResourceModel copyWith({
    String? id,
    ResourceType? type,
    String? name,
    String? district,
    ResourceStatus? status,
    double? latitude,
    double? longitude,
    int? capacity,
    int? currentLoad,
    DateTime? lastUpdated,
    String? incidentId,
  }) {
    return ResourceModel(
      id: id ?? this.id,
      type: type ?? this.type,
      name: name ?? this.name,
      district: district ?? this.district,
      status: status ?? this.status,
      latitude: latitude ?? this.latitude,
      longitude: longitude ?? this.longitude,
      capacity: capacity ?? this.capacity,
      currentLoad: currentLoad ?? this.currentLoad,
      lastUpdated: lastUpdated ?? this.lastUpdated,
      incidentId: incidentId ?? this.incidentId,
    );
  }

  static double? _asNullableDouble(dynamic value) {
    if (value == null) {
      return null;
    }
    if (value is double) {
      return value;
    }
    if (value is int) {
      return value.toDouble();
    }
    if (value is String) {
      return double.tryParse(value);
    }
    return null;
  }

  static int? _asNullableInt(dynamic value) {
    if (value == null) {
      return null;
    }
    if (value is int) {
      return value;
    }
    if (value is double) {
      return value.round();
    }
    if (value is String) {
      return int.tryParse(value);
    }
    return null;
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
    return 'ResourceModel{id: $id, type: ${type.toApiValue()}, name: $name, district: $district, status: ${status.toApiValue()}, lastUpdated: ${lastUpdated.toUtc().toIso8601String()}}';
  }
}
