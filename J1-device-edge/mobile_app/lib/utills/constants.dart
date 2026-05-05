class AppConstants {
  static const String databaseName = 'j1_disaster_response.db';
  static const int databaseVersion = 1;

  static const String eventsTable = 'events';
  static const String usersTable = 'users';
  static const String incomingReportsTable = 'incoming_reports';
  static const String confirmedIncidentsTable = 'confirmed_incidents';
  static const String resourcesTable = 'resources';
  static const String alertsTable = 'alerts';
  static const String syncMetadataTable = 'sync_metadata';

  static const String statusQueued = 'QUEUED';
  static const String statusSubmitted = 'SUBMITTED';
  static const String statusFailed = 'FAILED';
}