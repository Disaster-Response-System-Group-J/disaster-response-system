import 'dart:async';

import '../models/incident.dart';

/// In-memory incident service used by the mobile app.
/// Replace with HTTP + websocket integration for real-time sync.
class IncidentService {
  static final List<Incident> _incidents = [
    Incident(
      id: 'INC-1001',
      type: 'Flooding',
      zone: 'ZONE-A',
      assignedTo: 'FO-A01',
      reportedAt: DateTime.now().subtract(const Duration(hours: 2)),
      priority: 'HIGH',
      description: 'River overflowed, water entering low-lying areas.',
      latitude: 12.9716,
      longitude: 77.5946,
      status: IncidentStatus.reported,
      media: [],
    ),
    Incident(
      id: 'INC-1002',
      type: 'Road Block',
      zone: 'ZONE-B',
      assignedTo: '',
      reportedAt: DateTime.now().subtract(const Duration(hours: 1, minutes: 20)),
      priority: 'MEDIUM',
      description: 'Tree fallen blocking main arterial route.',
      latitude: 12.2958,
      longitude: 76.6394,
      status: IncidentStatus.reported,
      media: [],
    ),
  ];

  static final StreamController<Incident> _updates = StreamController.broadcast();

  /// Stream of incident updates for UI to listen and sync with dashboard.
  static Stream<Incident> get updates => _updates.stream;

  /// Returns incidents for a specific zone. If zone is null, returns all.
  static Future<List<Incident>> getIncidentsForZone(String? zone) async {
    await Future.delayed(const Duration(milliseconds: 300));
    if (zone == null) return List.from(_incidents);
    return _incidents.where((i) => i.zone == zone).toList();
  }

  /// Update incident status and broadcast change.
  static Future<void> updateIncidentStatus(String incidentId, IncidentStatus status) async {
    final idx = _incidents.indexWhere((i) => i.id == incidentId);
    if (idx == -1) return;
    _incidents[idx].status = status;
    _updates.add(_incidents[idx]);
    await Future.delayed(const Duration(milliseconds: 200));
  }

  /// Add a field observation (appends to description for now) and broadcast.
  static Future<void> addObservation(String incidentId, String note) async {
    final idx = _incidents.indexWhere((i) => i.id == incidentId);
    if (idx == -1) return;
    final cur = _incidents[idx];
    cur.description = '${cur.description}\n\n[OBS] $note';
    _updates.add(cur);
    await Future.delayed(const Duration(milliseconds: 200));
  }

  /// Resource request currently attaches 'needResources' status and broadcasts.
  static Future<void> requestResources(String incidentId, List<String> resources) async {
    final idx = _incidents.indexWhere((i) => i.id == incidentId);
    if (idx == -1) return;
    _incidents[idx].status = IncidentStatus.needResources;
    _incidents[idx].description = '${_incidents[idx].description}\n\n[RESOURCES REQUESTED] ${resources.join(', ')}';
    _updates.add(_incidents[idx]);
    await Future.delayed(const Duration(milliseconds: 200));
  }
}
