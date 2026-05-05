class AppConstants {
  static const String databaseName = 'j1_disaster_response.db';
  static const int databaseVersion = 1;

  static const String eventsTable = 'events';

  static const String statusQueued = 'QUEUED';
  static const String statusSubmitted = 'SUBMITTED';
  static const String statusFailed = 'FAILED';

  // API Configuration
  // TODO: Update apiBaseUrl to your backend server
  // Example: 'http://192.168.1.100:3000' for local testing
  // Example: 'https://api.yourdomain.com' for production
  static const String apiBaseUrl = 'http://your-api-server.com';
  static const String apiUploadEndpoint = '/api/events/upload';
  
  // For local testing with a mock server:
  // static const String apiBaseUrl = 'http://192.168.1.100:3000';
}