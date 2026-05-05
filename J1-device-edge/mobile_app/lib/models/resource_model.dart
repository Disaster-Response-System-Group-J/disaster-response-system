/// Resource Model for disaster response emergency resources
/// Represents backend-managed read-only resources like shelters, rescue teams, etc.

enum ResourceType {
  RESCUE_TEAM,
  BOAT,
  AMBULANCE,
  SHELTER,
  MEDICAL_TEAM,
  FOOD_WATER,
}

enum ResourceStatus {
  AVAILABLE,
  ASSIGNED,
  BUSY,
  OUT_OF_SERVICE,
}

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
  });

  /// Convert ResourceType enum to string
  static String typeToString(ResourceType type) {
    return type.toString().split('.').last;
  }

  /// Convert string to ResourceType enum
  static ResourceType stringToType(String typeString) {
    return ResourceType.values.firstWhere(
      (e) => e.toString().split('.').last == typeString,
      orElse: () => ResourceType.SHELTER,
    );
  }

  /// Convert ResourceStatus enum to string
  static String statusToString(ResourceStatus status) {
    return status.toString().split('.').last;
  }

  /// Convert string to ResourceStatus enum
  static ResourceStatus stringToStatus(String statusString) {
    return ResourceStatus.values.firstWhere(
      (e) => e.toString().split('.').last == statusString,
      orElse: () => ResourceStatus.AVAILABLE,
    );
  }

  /// Convert model to SQLite map
  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'type': typeToString(type),
      'name': name,
      'district': district,
      'status': statusToString(status),
      'latitude': latitude,
      'longitude': longitude,
      'capacity': capacity,
      'current_load': currentLoad,
      'last_updated': lastUpdated.toIso8601String(),
    };
  }

  /// Create model from SQLite map
  factory ResourceModel.fromMap(Map<String, dynamic> map) {
    return ResourceModel(
      id: map['id'] as String,
      type: stringToType(map['type'] as String),
      name: map['name'] as String,
      district: map['district'] as String,
      status: stringToStatus(map['status'] as String),
      latitude: map['latitude'] != null ? (map['latitude'] as num).toDouble() : null,
      longitude: map['longitude'] != null ? (map['longitude'] as num).toDouble() : null,
      capacity: map['capacity'] as int?,
      currentLoad: map['current_load'] as int?,
      lastUpdated: DateTime.parse(map['last_updated'] as String),
    );
  }

  /// Convert model to JSON (for API responses)
  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'type': typeToString(type),
      'name': name,
      'district': district,
      'status': statusToString(status),
      'latitude': latitude,
      'longitude': longitude,
      'capacity': capacity,
      'currentLoad': currentLoad,
      'lastUpdated': lastUpdated.toIso8601String(),
    };
  }

  /// Create model from JSON (API response)
  factory ResourceModel.fromJson(Map<String, dynamic> json) {
    return ResourceModel(
      id: json['id'] as String,
      type: stringToType(json['type'] as String),
      name: json['name'] as String,
      district: json['district'] as String,
      status: stringToStatus(json['status'] as String),
      latitude: json['latitude'] != null ? (json['latitude'] as num).toDouble() : null,
      longitude: json['longitude'] != null ? (json['longitude'] as num).toDouble() : null,
      capacity: json['capacity'] as int?,
      currentLoad: json['currentLoad'] as int?,
      lastUpdated: DateTime.parse(json['lastUpdated'] as String? ?? DateTime.now().toIso8601String()),
    );
  }

  /// Create a copy with optional field overrides
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
    );
  }

  @override
  String toString() =>
      'ResourceModel(id: $id, type: ${typeToString(type)}, name: $name, district: $district, status: ${statusToString(status)})';

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is ResourceModel &&
          runtimeType == other.runtimeType &&
          id == other.id &&
          type == other.type &&
          name == other.name &&
          district == other.district &&
          status == other.status;

  @override
  int get hashCode =>
      id.hashCode ^
      type.hashCode ^
      name.hashCode ^
      district.hashCode ^
      status.hashCode;
}
