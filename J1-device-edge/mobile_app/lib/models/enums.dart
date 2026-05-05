enum ReportSource {
  J1_SOS_APP('J1_SOS_APP', 'SOS App'),
  J3_PUBLIC_PORTAL('J3_PUBLIC_PORTAL', 'Public Portal'),
  J1_SENSOR_SYSTEM('J1_SENSOR_SYSTEM', 'Sensor System'),
  WEATHER_API('WEATHER_API', 'Weather API'),
  OFFICER_CREATED('OFFICER_CREATED', 'Officer Created');

  final String apiValue;
  final String display;
  const ReportSource(this.apiValue, this.display);

  String toApiValue() => apiValue;
  String displayName() => display;
  static ReportSource fromApiValue(String v) =>
      ReportSource.values.firstWhere((e) => e.apiValue == v, orElse: () => ReportSource.J1_SOS_APP);
}

enum DisasterType { FLOOD('FLOOD'), LANDSLIDE('LANDSLIDE'), OTHER('OTHER');
  final String apiValue; const DisasterType(this.apiValue);
  String toApiValue() => apiValue;
  static DisasterType fromApiValue(String v) => DisasterType.values.firstWhere((e) => e.apiValue == v, orElse: () => DisasterType.OTHER);
}

enum VerificationStatus {
  PENDING_REVIEW('PENDING_REVIEW'),
  VERIFIED('VERIFIED'),
  REJECTED('REJECTED'),
  DUPLICATE('DUPLICATE'),
  CONVERTED_TO_INCIDENT('CONVERTED_TO_INCIDENT');

  final String apiValue; const VerificationStatus(this.apiValue);
  String toApiValue() => apiValue;
  static VerificationStatus fromApiValue(String v) => VerificationStatus.values.firstWhere((e) => e.apiValue == v, orElse: () => VerificationStatus.PENDING_REVIEW);
}

enum IncidentSeverity { LOW('LOW'), MEDIUM('MEDIUM'), HIGH('HIGH'), CRITICAL('CRITICAL');
  final String apiValue; const IncidentSeverity(this.apiValue);
  String toApiValue() => apiValue;
  static IncidentSeverity fromApiValue(String v) => IncidentSeverity.values.firstWhere((e) => e.apiValue == v, orElse: () => IncidentSeverity.LOW);
}

enum IncidentStatus { ACTIVE('ACTIVE'), UNDER_RESPONSE('UNDER_RESPONSE'), RESOLVED('RESOLVED'), CLOSED('CLOSED');
  final String apiValue; const IncidentStatus(this.apiValue);
  String toApiValue() => apiValue;
  static IncidentStatus fromApiValue(String v) => IncidentStatus.values.firstWhere((e) => e.apiValue == v, orElse: () => IncidentStatus.ACTIVE);
}

enum ResourceType {
  RESCUE_TEAM('RESCUE_TEAM'),
  BOAT('BOAT'),
  AMBULANCE('AMBULANCE'),
  SHELTER('SHELTER'),
  MEDICAL_TEAM('MEDICAL_TEAM'),
  FOOD_WATER('FOOD_WATER');

  final String apiValue; const ResourceType(this.apiValue);
  String toApiValue() => apiValue;
  static ResourceType fromApiValue(String v) => ResourceType.values.firstWhere((e) => e.apiValue == v, orElse: () => ResourceType.RESCUE_TEAM);
}

enum ResourceStatus { AVAILABLE('AVAILABLE'), ASSIGNED('ASSIGNED'), BUSY('BUSY'), OUT_OF_SERVICE('OUT_OF_SERVICE');
  final String apiValue; const ResourceStatus(this.apiValue);
  String toApiValue() => apiValue;
  static ResourceStatus fromApiValue(String v) => ResourceStatus.values.firstWhere((e) => e.apiValue == v, orElse: () => ResourceStatus.AVAILABLE);
}

enum AlertType { RISK_ALERT('RISK_ALERT'), PUBLIC_ALERT('PUBLIC_ALERT'), SHELTER_CAPACITY('SHELTER_CAPACITY'), RESOURCE_SHORTAGE('RESOURCE_SHORTAGE'), INCIDENT_STATUS('INCIDENT_STATUS');
  final String apiValue; const AlertType(this.apiValue);
  String toApiValue() => apiValue;
  static AlertType fromApiValue(String v) => AlertType.values.firstWhere((e) => e.apiValue == v, orElse: () => AlertType.RISK_ALERT);
}

enum UserRole { PUBLIC_USER('PUBLIC_USER'), OFFICER('OFFICER'), RESOURCE_MANAGER('RESOURCE_MANAGER'), ADMIN('ADMIN');
  final String apiValue; const UserRole(this.apiValue);
  String toApiValue() => apiValue;
  static UserRole fromApiValue(String v) => UserRole.values.firstWhere((e) => e.apiValue == v, orElse: () => UserRole.PUBLIC_USER);
}
