class AppConstants {
  static const String databaseName = 'j1_disaster_response.db';
  static const int databaseVersion = 2;

  static const String eventsTable = 'events';

  static const String statusQueued = 'QUEUED';
  static const String statusClaimed = 'CLAIMED';
  static const String statusSubmitted = 'SUBMITTED';
  static const String statusDuplicate = 'DUPLICATE';
  static const String statusFailed = 'FAILED';

  // API configuration
  // Android emulator default: http://10.0.2.2:8000 maps to host localhost.
  // Physical device: use http://<PC_LAN_IP>:8000, or with adb reverse use http://127.0.0.1:8000
  // iOS simulator: run with --dart-define=J1_API_BASE_URL=http://localhost:8000
  static const String apiBaseUrl = String.fromEnvironment(
    'J1_API_BASE_URL',
    defaultValue: 'http://10.0.2.2:8000',
  );
  static const String apiHealthEndpoint = '/health';
  static const String apiIngestEndpoint = '/api/v1/events/ingest';
  static const String apiUploadEndpoint = '/api/v1/upload';
  static const String apiResourcesEndpoint = '/api/v1/resources';

  static const int maxSyncRetries = 5;
  static const int syncTimeoutSeconds = 15;
  static const int syncPollingIntervalSeconds = 30;
}
