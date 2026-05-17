class AppConstants {
  static const String databaseName = 'j1_disaster_response.db';
  static const int databaseVersion = 2;

  static const String eventsTable = 'events';

  static const String statusQueued = 'QUEUED';
  static const String statusClaimed = 'CLAIMED';
  static const String statusSubmitted = 'SUBMITTED';
  static const String statusDuplicate = 'DUPLICATE';
  static const String statusFailed = 'FAILED';

  // Run with: flutter run --dart-define=J1_API_BASE_URL=http://<LAN_IP>:8081
  static const String apiBaseUrl = String.fromEnvironment(
    'J1_API_BASE_URL',
    defaultValue: 'http://192.168.1.100:8081',
  );

  static const String apiHealthEndpoint = '/health';
  static const String apiIngestEndpoint = '/api/v1/ingest/report';
  static const String apiResourcesEndpoint = '/api/v1/resources';

  static const int maxSyncRetries = 5;
  static const int syncTimeoutSeconds = 15;
  static const int syncPollingIntervalSeconds = 30;
}
