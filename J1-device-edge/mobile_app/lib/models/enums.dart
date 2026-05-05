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

enum DisasterType {
  FLOOD('FLOOD', 'Flood'),
  LANDSLIDE('LANDSLIDE', 'Landslide'),
  OTHER('OTHER', 'Other');

  final String apiValue;
  final String display;
  const DisasterType(this.apiValue, this.display);

  String toApiValue() => apiValue;
  String displayName() => display;
  static DisasterType fromApiValue(String v) =>
      DisasterType.values.firstWhere((e) => e.apiValue == v, orElse: () => DisasterType.OTHER);
}

enum VerificationStatus {
  PENDING_REVIEW('PENDING_REVIEW', 'Pending review'),
  VERIFIED('VERIFIED', 'Verified'),
  REJECTED('REJECTED', 'Rejected'),
  DUPLICATE('DUPLICATE', 'Duplicate'),
  CONVERTED_TO_INCIDENT('CONVERTED_TO_INCIDENT', 'Converted');

  final String apiValue;
  final String display;
  const VerificationStatus(this.apiValue, this.display);

  String toApiValue() => apiValue;
  String displayName() => display;
  static VerificationStatus fromApiValue(String v) => VerificationStatus.values.firstWhere((e) => e.apiValue == v, orElse: () => VerificationStatus.PENDING_REVIEW);
}

enum IncidentSeverity {
  LOW('LOW', 'Low'),
  MEDIUM('MEDIUM', 'Medium'),
  HIGH('HIGH', 'High'),
  CRITICAL('CRITICAL', 'Critical');

  final String apiValue;
  final String display;
  const IncidentSeverity(this.apiValue, this.display);

  String toApiValue() => apiValue;
  String displayName() => display;
  static IncidentSeverity fromApiValue(String v) => IncidentSeverity.values.firstWhere((e) => e.apiValue == v, orElse: () => IncidentSeverity.LOW);
}

enum IncidentStatus {
  ACTIVE('ACTIVE', 'Active'),
  UNDER_RESPONSE('UNDER_RESPONSE', 'Under response'),
  RESOLVED('RESOLVED', 'Resolved'),
  CLOSED('CLOSED', 'Closed');

  final String apiValue;
  final String display;
  const IncidentStatus(this.apiValue, this.display);

  String toApiValue() => apiValue;
  String displayName() => display;
  static IncidentStatus fromApiValue(String v) => IncidentStatus.values.firstWhere((e) => e.apiValue == v, orElse: () => IncidentStatus.ACTIVE);
}

enum ResourceType {
  RESCUE_TEAM('RESCUE_TEAM', 'Rescue Team'),
  BOAT('BOAT', 'Boat'),
  AMBULANCE('AMBULANCE', 'Ambulance'),
  SHELTER('SHELTER', 'Shelter'),
  MEDICAL_TEAM('MEDICAL_TEAM', 'Medical Team'),
  FOOD_WATER('FOOD_WATER', 'Food & Water');

  final String apiValue;
  final String display;
  const ResourceType(this.apiValue, this.display);

  String toApiValue() => apiValue;
  String displayName() => display;
  static ResourceType fromApiValue(String v) => ResourceType.values.firstWhere((e) => e.apiValue == v, orElse: () => ResourceType.RESCUE_TEAM);
}

enum ResourceStatus {
  AVAILABLE('AVAILABLE', 'Available'),
  ASSIGNED('ASSIGNED', 'Assigned'),
  BUSY('BUSY', 'Busy'),
  OUT_OF_SERVICE('OUT_OF_SERVICE', 'Out of service');

  final String apiValue;
  final String display;
  const ResourceStatus(this.apiValue, this.display);

  String toApiValue() => apiValue;
  String displayName() => display;
  static ResourceStatus fromApiValue(String v) => ResourceStatus.values.firstWhere((e) => e.apiValue == v, orElse: () => ResourceStatus.AVAILABLE);
}

enum AlertType {
  RISK_ALERT('RISK_ALERT', 'Risk Alert'),
  PUBLIC_ALERT('PUBLIC_ALERT', 'Public Alert'),
  SHELTER_CAPACITY('SHELTER_CAPACITY', 'Shelter Capacity'),
  RESOURCE_SHORTAGE('RESOURCE_SHORTAGE', 'Resource Shortage'),
  INCIDENT_STATUS('INCIDENT_STATUS', 'Incident Status');

  final String apiValue;
  final String display;
  const AlertType(this.apiValue, this.display);

  String toApiValue() => apiValue;
  String displayName() => display;
  static AlertType fromApiValue(String v) => AlertType.values.firstWhere((e) => e.apiValue == v, orElse: () => AlertType.RISK_ALERT);
}

enum UserRole {
  PUBLIC_USER('PUBLIC_USER', 'Public User'),
  OFFICER('OFFICER', 'Officer'),
  RESOURCE_MANAGER('RESOURCE_MANAGER', 'Resource Manager'),
  ADMIN('ADMIN', 'Administrator');

  final String apiValue;
  final String display;
  const UserRole(this.apiValue, this.display);

  String toApiValue() => apiValue;
  String displayName() => display;
  static UserRole fromApiValue(String v) => UserRole.values.firstWhere((e) => e.apiValue == v, orElse: () => UserRole.PUBLIC_USER);
}
