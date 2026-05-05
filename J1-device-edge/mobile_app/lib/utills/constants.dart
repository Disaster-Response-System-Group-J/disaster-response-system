class AppConstants {
  static const String databaseName = 'j1_disaster_response.db';
  static const int databaseVersion = 2;

  static const String eventsTable = 'events';

  // Event status constants (PRODUCTION)
  static const String statusQueued = 'QUEUED';
  static const String statusClaimed = 'CLAIMED';
  static const String statusSubmitted = 'SUBMITTED';
  static const String statusDuplicate = 'DUPLICATE';
  static const String statusFailed = 'FAILED';

  // API Configuration (PRODUCTION - MUST UPDATE BEFORE DEPLOYMENT)
  // Format: https://api.backend.com (production) or http://192.168.1.100:3000 (local)
  static const String apiBaseUrl = 'http://your-api-server.com';
  static const String apiIngestEndpoint = '/api/v1/events/ingest';
  static const String apiUploadEndpoint = apiIngestEndpoint;
  
  // Sync configuration
  static const int maxSyncRetries = 5;
  static const int syncTimeoutSeconds = 15;
  static const int syncPollingIntervalSeconds = 30;
}
