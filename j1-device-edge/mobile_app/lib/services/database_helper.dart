import 'dart:convert';

import 'package:path/path.dart';
import 'package:sqflite/sqflite.dart';
import 'package:uuid/uuid.dart';

import '../models/app_user.dart';
import '../utills/constants.dart';
import '../models/event_model.dart';
import '../models/request_model.dart';
import '../models/resource_model.dart';

class DatabaseHelper {
  static final DatabaseHelper instance = DatabaseHelper._internal();

  static Database? _database;
  Set<String>? _eventsColumns;
  static const String usersTable = 'users';
  static const String sessionTable = 'auth_session';
  static const String metaTable = 'app_meta';
  static const String _apiBaseUrlMetaKey = 'api_base_url';

  DatabaseHelper._internal();

  Future<Database> get database async {
    if (_database != null) return _database!;

    _database = await _initDatabase();
    return _database!;
  }

  Future<Database> _initDatabase() async {
    final databasePath = await getDatabasesPath();
    final path = join(databasePath, AppConstants.databaseName);

    final db = await openDatabase(
      path,
      version: AppConstants.databaseVersion,
      onCreate: _onCreate,
      onUpgrade: _onUpgrade,
    );

    await _ensureEventsSchema(db);
    await _ensureResourcesSchema(db);
    await _ensureSeedData(db);
    return db;
  }

  Future<void> _onCreate(Database db, int version) async {
    await _createAuthTables(db);
    await _createEventsTable(db);
    await _createResourcesTable(db);
    await _ensureSeedData(db);
  }

  Future<void> _onUpgrade(Database db, int oldVersion, int newVersion) async {
    if (oldVersion < 2) {
      await _createAuthTables(db);
    }

    await _ensureEventsSchema(db);
    await _ensureResourcesSchema(db);

    await _ensureSeedData(db);
  }

  Future<void> _createEventsTable(Database db) async {
    await db.execute('''
      CREATE TABLE IF NOT EXISTS ${AppConstants.eventsTable} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id TEXT UNIQUE NOT NULL,
        event_type TEXT NOT NULL,
        event_version TEXT NOT NULL DEFAULT '1.0',
        user_id TEXT NOT NULL,
        device_id TEXT NOT NULL,
        payload TEXT NOT NULL,
        metadata TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'QUEUED',
        claimed_by_user_id TEXT,
        claimed_by_user_name TEXT,
        claimed_at DATETIME,
        sync_attempts INTEGER DEFAULT 0,
        last_sync_error TEXT,
        last_sync_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        submitted_at DATETIME,
        CHECK (status IN ('QUEUED', 'CLAIMED', 'SUBMITTED', 'FAILED', 'DUPLICATE'))
      )
    ''');

    await db.execute('CREATE INDEX IF NOT EXISTS idx_events_status ON ${AppConstants.eventsTable}(status)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_events_user_id ON ${AppConstants.eventsTable}(user_id)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_events_created_at ON ${AppConstants.eventsTable}(created_at DESC)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_events_event_id ON ${AppConstants.eventsTable}(event_id)');
  }

  Future<void> _ensureEventsSchema(Database db) async {
    final existingColumns = await _getTableColumns(db, AppConstants.eventsTable);
    _eventsColumns = existingColumns;
    if (existingColumns.isEmpty) {
      await _createEventsTable(db);
      return;
    }

    final requiredColumns = <String>[
      'event_id',
      'event_type',
      'event_version',
      'user_id',
      'device_id',
      'payload',
      'metadata',
      'status',
      'claimed_by_user_id',
      'claimed_by_user_name',
      'claimed_at',
      'sync_attempts',
      'last_sync_error',
      'last_sync_at',
      'created_at',
      'submitted_at',
    ];

    final legacyLayoutDetected =
        existingColumns.contains('type') ||
        existingColumns.contains('createdAt') ||
        existingColumns.contains('submittedAt') ||
        existingColumns.contains('userId') ||
        existingColumns.contains('deviceId') ||
        existingColumns.contains('eventVersion') ||
        existingColumns.contains('lastSyncAt') ||
        existingColumns.contains('lastSyncError') ||
        existingColumns.contains('claimedByUserId') ||
        existingColumns.contains('claimedByUserName') ||
        existingColumns.contains('claimedAt') ||
        !existingColumns.contains('claimed_by_user_id') ||
        !existingColumns.contains('claimed_by_user_name') ||
        !existingColumns.contains('claimed_at') ||
        !existingColumns.contains('event_type') ||
        !existingColumns.contains('created_at');

    if (legacyLayoutDetected) {
      await _rebuildEventsTable(db, existingColumns);
      _eventsColumns = await _getTableColumns(db, AppConstants.eventsTable);
      return;
    }

    final missingColumns = requiredColumns
        .where((column) => !existingColumns.contains(column))
        .toList();

    if (missingColumns.isEmpty) {
      await _createEventsTable(db);
      return;
    }

    for (final column in missingColumns) {
      final definition = switch (column) {
        'event_type' => "TEXT NOT NULL DEFAULT ''",
        'event_version' => "TEXT NOT NULL DEFAULT '1.0'",
        'user_id' => "TEXT NOT NULL DEFAULT ''",
        'device_id' => "TEXT NOT NULL DEFAULT ''",
        'payload' => "TEXT NOT NULL DEFAULT ''",
        'metadata' => "TEXT NOT NULL DEFAULT '{}'",
        'status' => "TEXT NOT NULL DEFAULT 'QUEUED'",
        'claimed_by_user_id' => 'TEXT',
        'claimed_by_user_name' => 'TEXT',
        'claimed_at' => 'DATETIME',
        'sync_attempts' => 'INTEGER DEFAULT 0',
        'last_sync_error' => 'TEXT',
        'last_sync_at' => 'DATETIME',
        'created_at' => 'TEXT',
        'submitted_at' => 'DATETIME',
        _ => 'TEXT',
      };

      await db.execute(
        'ALTER TABLE ${AppConstants.eventsTable} ADD COLUMN $column $definition',
      );
    }

    if (existingColumns.contains('type')) {
      await db.rawUpdate('''
        UPDATE ${AppConstants.eventsTable}
        SET event_type = COALESCE(NULLIF(event_type, ''), type)
      ''');
    }

    if (existingColumns.contains('createdAt')) {
      await db.rawUpdate('''
        UPDATE ${AppConstants.eventsTable}
        SET created_at = COALESCE(NULLIF(created_at, ''), createdAt)
      ''');
    } else if (missingColumns.contains('created_at')) {
      await db.rawUpdate('''
        UPDATE ${AppConstants.eventsTable}
        SET created_at = COALESCE(NULLIF(created_at, ''), CURRENT_TIMESTAMP)
      ''');
    }

    if (existingColumns.contains('submittedAt')) {
      await db.rawUpdate('''
        UPDATE ${AppConstants.eventsTable}
        SET submitted_at = COALESCE(submitted_at, submittedAt)
      ''');
    }

    if (existingColumns.contains('userId')) {
      await db.rawUpdate('''
        UPDATE ${AppConstants.eventsTable}
        SET user_id = COALESCE(NULLIF(user_id, ''), userId)
      ''');
    }

    if (existingColumns.contains('deviceId')) {
      await db.rawUpdate('''
        UPDATE ${AppConstants.eventsTable}
        SET device_id = COALESCE(NULLIF(device_id, ''), deviceId)
      ''');
    }

    if (existingColumns.contains('eventVersion')) {
      await db.rawUpdate('''
        UPDATE ${AppConstants.eventsTable}
        SET event_version = COALESCE(NULLIF(event_version, ''), eventVersion)
      ''');
    }

    if (existingColumns.contains('lastSyncAt')) {
      await db.rawUpdate('''
        UPDATE ${AppConstants.eventsTable}
        SET last_sync_at = COALESCE(last_sync_at, lastSyncAt)
      ''');
    }

    if (existingColumns.contains('lastSyncError')) {
      await db.rawUpdate('''
        UPDATE ${AppConstants.eventsTable}
        SET last_sync_error = COALESCE(last_sync_error, lastSyncError)
      ''');
    }

    if (existingColumns.contains('claimedByUserId')) {
      await db.rawUpdate('''
        UPDATE ${AppConstants.eventsTable}
        SET claimed_by_user_id = COALESCE(claimed_by_user_id, claimedByUserId)
      ''');
    }

    if (existingColumns.contains('claimedByUserName')) {
      await db.rawUpdate('''
        UPDATE ${AppConstants.eventsTable}
        SET claimed_by_user_name = COALESCE(claimed_by_user_name, claimedByUserName)
      ''');
    }

    if (existingColumns.contains('claimedAt')) {
      await db.rawUpdate('''
        UPDATE ${AppConstants.eventsTable}
        SET claimed_at = COALESCE(claimed_at, claimedAt)
      ''');
    }

    await _createEventsTable(db);
    _eventsColumns = await _getTableColumns(db, AppConstants.eventsTable);
  }

  Future<void> _rebuildEventsTable(
    Database db,
    Set<String> existingColumns,
  ) async {
    final legacyRows = await db.query(AppConstants.eventsTable);
    final legacyName =
        '${AppConstants.eventsTable}_legacy_${DateTime.now().millisecondsSinceEpoch}';

    await db.execute(
      'ALTER TABLE ${AppConstants.eventsTable} RENAME TO $legacyName',
    );
    await _createEventsTable(db);

    final typeColumn = existingColumns.contains('event_type')
        ? 'event_type'
        : existingColumns.contains('type')
            ? 'type'
            : null;
    final createdColumn = existingColumns.contains('created_at')
        ? 'created_at'
        : existingColumns.contains('createdAt')
            ? 'createdAt'
            : null;
    final submittedColumn = existingColumns.contains('submitted_at')
        ? 'submitted_at'
        : existingColumns.contains('submittedAt')
            ? 'submittedAt'
            : null;
    final claimedByUserIdColumn = existingColumns.contains('claimed_by_user_id')
        ? 'claimed_by_user_id'
        : existingColumns.contains('claimedByUserId')
            ? 'claimedByUserId'
            : null;
    final claimedByUserNameColumn = existingColumns.contains('claimed_by_user_name')
        ? 'claimed_by_user_name'
        : existingColumns.contains('claimedByUserName')
            ? 'claimedByUserName'
            : null;
    final claimedAtColumn = existingColumns.contains('claimed_at')
        ? 'claimed_at'
        : existingColumns.contains('claimedAt')
            ? 'claimedAt'
            : null;
    final userColumn = existingColumns.contains('user_id')
        ? 'user_id'
        : existingColumns.contains('userId')
            ? 'userId'
            : null;
    final deviceColumn = existingColumns.contains('device_id')
        ? 'device_id'
        : existingColumns.contains('deviceId')
            ? 'deviceId'
            : null;
    final versionColumn = existingColumns.contains('event_version')
        ? 'event_version'
        : existingColumns.contains('eventVersion')
            ? 'eventVersion'
            : null;
    final syncAttemptsColumn = existingColumns.contains('sync_attempts')
        ? 'sync_attempts'
        : existingColumns.contains('syncAttempts')
            ? 'syncAttempts'
            : null;
    final errorColumn = existingColumns.contains('last_sync_error')
        ? 'last_sync_error'
        : existingColumns.contains('lastSyncError')
            ? 'lastSyncError'
            : null;
    final lastSyncColumn = existingColumns.contains('last_sync_at')
        ? 'last_sync_at'
        : existingColumns.contains('lastSyncAt')
            ? 'lastSyncAt'
            : null;

    for (final row in legacyRows) {
      final insertedEvent = EventModel(
        eventId: row['event_id']?.toString() ?? const Uuid().v4(),
        type: (typeColumn == null
                ? null
                : row[typeColumn])?.toString() ??
            'UNKNOWN',
        data: row['payload']?.toString() ?? row['data']?.toString() ?? '{}',
        status: row['status']?.toString() ?? AppConstants.statusQueued,
        createdAt: (createdColumn == null
                ? null
                : row[createdColumn])?.toString() ??
            DateTime.now().toIso8601String(),
        submittedAt: (submittedColumn == null
                ? null
                : row[submittedColumn])?.toString(),
        claimedByUserId: (claimedByUserIdColumn == null
                ? null
                : row[claimedByUserIdColumn])?.toString(),
        claimedByUserName: (claimedByUserNameColumn == null
                ? null
                : row[claimedByUserNameColumn])?.toString(),
        claimedAt: (claimedAtColumn == null ? null : row[claimedAtColumn])?.toString(),
        userId: (userColumn == null ? null : row[userColumn])?.toString() ??
            'legacy-user',
        deviceId: (deviceColumn == null ? null : row[deviceColumn])?.toString() ??
            'legacy-device',
        syncAttempts: int.tryParse(
              (syncAttemptsColumn == null ? null : row[syncAttemptsColumn])
                      ?.toString() ??
                  '0',
            ) ??
            0,
        lastSyncError: (errorColumn == null ? null : row[errorColumn])?.toString(),
        metadata: _decodeMetadata(row['metadata']),
        eventVersion: (versionColumn == null
                ? null
                : row[versionColumn])?.toString() ??
            '1.0',
        lastSyncAt: (lastSyncColumn == null ? null : row[lastSyncColumn])?.toString(),
      );

      await db.insert(
        AppConstants.eventsTable,
        insertedEvent.toMap(),
        conflictAlgorithm: ConflictAlgorithm.replace,
      );
    }
  }

  Future<Set<String>> _getTableColumns(Database db, String tableName) async {
    final result = await db.rawQuery('PRAGMA table_info($tableName)');
    return result
        .map((row) => row['name']?.toString() ?? '')
        .where((name) => name.isNotEmpty)
        .toSet();
  }

  Future<void> _createAuthTables(Database db) async {
    await db.execute('''
      CREATE TABLE IF NOT EXISTS $usersTable (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'PUBLIC_USER',
        is_mock INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        last_login_at TEXT
      )
    ''');

    await db.execute('''
      CREATE TABLE IF NOT EXISTS $sessionTable (
        session_key TEXT PRIMARY KEY,
        session_value TEXT NOT NULL
      )
    ''');

    await db.execute('''
      CREATE TABLE IF NOT EXISTS $metaTable (
        meta_key TEXT PRIMARY KEY,
        meta_value TEXT NOT NULL
      )
    ''');
  }

  Future<void> _ensureSeedData(Database db) async {
    final deviceIdResult = await db.query(
      metaTable,
      where: 'meta_key = ?',
      whereArgs: ['device_id'],
      limit: 1,
    );
    final deviceId = deviceIdResult.isNotEmpty
        ? deviceIdResult.first['meta_value']?.toString()
        : null;
    if (deviceId == null || deviceId.isEmpty) {
      await db.insert(
        metaTable,
        {
          'meta_key': 'device_id',
          'meta_value': const Uuid().v4(),
        },
        conflictAlgorithm: ConflictAlgorithm.replace,
      );
    }

    final mockUserResult = await db.query(
      usersTable,
      where: 'email = ?',
      whereArgs: ['mock.user@j1.local'],
      limit: 1,
    );
    final mockUserExists = mockUserResult.isNotEmpty;
    if (!mockUserExists) {
      final seededUser = AppUser(
        id: const Uuid().v4(),
        name: 'Mock User',
        email: 'mock.user@j1.local',
        password: 'mock1234',
        role: 'PUBLIC_USER',
        isMock: true,
        createdAt: DateTime.now().toUtc().toIso8601String(),
      );

      await db.insert(
        usersTable,
        seededUser.toMap(),
        conflictAlgorithm: ConflictAlgorithm.replace,
      );
    }

    // Seed demo resources for offline mode
    await _ensureDemoResources(db);
  }

  /// Seed demo resources once during database initialization
  Future<void> _ensureDemoResources(Database db) async {
    final existingResources = await db.query('resources', limit: 1);
    
    // Only seed if no resources exist
    if (existingResources.isNotEmpty) {
      return;
    }

    final demoResources = [
      ResourceModel(
        id: const Uuid().v4(),
        type: ResourceType.SHELTER,
        name: 'Colombo Central Shelter',
        district: 'Colombo',
        status: ResourceStatus.AVAILABLE,
        latitude: 6.9271,
        longitude: 79.8612,
        capacity: 300,
        currentLoad: 120,
        lastUpdated: DateTime.now(),
      ),
      ResourceModel(
        id: const Uuid().v4(),
        type: ResourceType.SHELTER,
        name: 'Kandy District Relief Center',
        district: 'Kandy',
        status: ResourceStatus.AVAILABLE,
        latitude: 6.9271,
        longitude: 80.6328,
        capacity: 200,
        currentLoad: 85,
        lastUpdated: DateTime.now(),
      ),
      ResourceModel(
        id: const Uuid().v4(),
        type: ResourceType.RESCUE_TEAM,
        name: 'Colombo Rescue Team Alpha',
        district: 'Colombo',
        status: ResourceStatus.AVAILABLE,
        latitude: 6.9271,
        longitude: 79.8612,
        capacity: 15,
        currentLoad: 12,
        lastUpdated: DateTime.now(),
      ),
      ResourceModel(
        id: const Uuid().v4(),
        type: ResourceType.BOAT,
        name: 'Rescue Boat Team',
        district: 'Galle',
        status: ResourceStatus.AVAILABLE,
        latitude: 6.0535,
        longitude: 80.2210,
        capacity: 20,
        currentLoad: 8,
        lastUpdated: DateTime.now(),
      ),
      ResourceModel(
        id: const Uuid().v4(),
        type: ResourceType.AMBULANCE,
        name: 'Mobile Medical Unit - North',
        district: 'Jaffna',
        status: ResourceStatus.AVAILABLE,
        latitude: 9.6615,
        longitude: 80.0255,
        capacity: 4,
        currentLoad: 3,
        lastUpdated: DateTime.now(),
      ),
      ResourceModel(
        id: const Uuid().v4(),
        type: ResourceType.AMBULANCE,
        name: 'Emergency Ambulance Service',
        district: 'Colombo',
        status: ResourceStatus.AVAILABLE,
        latitude: 6.9271,
        longitude: 79.8612,
        capacity: 5,
        currentLoad: 2,
        lastUpdated: DateTime.now(),
      ),
      ResourceModel(
        id: const Uuid().v4(),
        type: ResourceType.MEDICAL_TEAM,
        name: 'Mobile Medical Unit',
        district: 'Colombo',
        status: ResourceStatus.AVAILABLE,
        latitude: 6.9271,
        longitude: 79.8612,
        capacity: 30,
        currentLoad: 25,
        lastUpdated: DateTime.now(),
      ),
      ResourceModel(
        id: const Uuid().v4(),
        type: ResourceType.FOOD_WATER,
        name: 'Food & Water Distribution Point',
        district: 'Colombo',
        status: ResourceStatus.AVAILABLE,
        latitude: 6.9271,
        longitude: 79.8612,
        capacity: 500,
        currentLoad: 350,
        lastUpdated: DateTime.now(),
      ),
      ResourceModel(
        id: const Uuid().v4(),
        type: ResourceType.FOOD_WATER,
        name: 'Water Supply Station',
        district: 'Kandy',
        status: ResourceStatus.AVAILABLE,
        latitude: 6.9271,
        longitude: 80.6328,
        capacity: 1000,
        currentLoad: 750,
        lastUpdated: DateTime.now(),
      ),
    ];

    for (final resource in demoResources) {
      await db.insert(
        'resources',
        resource.toMap(),
        conflictAlgorithm: ConflictAlgorithm.replace,
      );
    }
  }

  Future<void> ensureMockUser() async {
    final db = await database;
    final mockUserResult = await db.query(
      usersTable,
      where: 'email = ?',
      whereArgs: ['mock.user@j1.local'],
      limit: 1,
    );
    if (mockUserResult.isNotEmpty) {
      return;
    }

    final seededUser = AppUser(
      id: const Uuid().v4(),
      name: 'Mock User',
      email: 'mock.user@j1.local',
      password: 'mock1234',
      role: 'PUBLIC_USER',
      isMock: true,
      createdAt: DateTime.now().toUtc().toIso8601String(),
    );

    await db.insert(
      usersTable,
      seededUser.toMap(),
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  Future<AppUser?> getUserByEmail(String email) async {
    final db = await database;
    final result = await db.query(
      usersTable,
      where: 'email = ?',
      whereArgs: [email.trim().toLowerCase()],
      limit: 1,
    );

    if (result.isEmpty) {
      return null;
    }

    return AppUser.fromMap(result.first);
  }

  Future<AppUser?> getUserById(String id) async {
    final db = await database;
    final result = await db.query(
      usersTable,
      where: 'id = ?',
      whereArgs: [id],
      limit: 1,
    );

    if (result.isEmpty) {
      return null;
    }

    return AppUser.fromMap(result.first);
  }

  Future<List<AppUser>> getUsers() async {
    final db = await database;
    final result = await db.query(
      usersTable,
      orderBy: 'created_at DESC',
    );

    return result.map(AppUser.fromMap).toList();
  }

  Future<int> insertUser(AppUser user) async {
    final db = await database;
    return db.insert(
      usersTable,
      user.toMap(),
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  Future<int> updateUserLastLogin(AppUser user) async {
    final db = await database;
    return db.update(
      usersTable,
      {
        'last_login_at': user.lastLoginAt,
      },
      where: 'id = ?',
      whereArgs: [user.id],
    );
  }

  Future<void> setCurrentSession(String userId) async {
    final db = await database;
    await db.insert(
      sessionTable,
      {
        'session_key': 'active_user_id',
        'session_value': userId,
      },
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  Future<void> clearCurrentSession() async {
    final db = await database;
    await db.delete(
      sessionTable,
      where: 'session_key = ?',
      whereArgs: ['active_user_id'],
    );
  }

  Future<AppUser?> getSessionUser() async {
    final db = await database;
    final sessionResult = await db.query(
      sessionTable,
      where: 'session_key = ?',
      whereArgs: ['active_user_id'],
      limit: 1,
    );

    if (sessionResult.isEmpty) {
      return null;
    }

    final userId = sessionResult.first['session_value']?.toString();
    if (userId == null || userId.isEmpty) {
      return null;
    }

    return getUserById(userId);
  }

  Future<String> getDeviceId() async {
    final db = await database;
    final existing = await _readMetaValue(db, 'device_id');
    if (existing != null && existing.isNotEmpty) {
      return existing;
    }

    final generated = const Uuid().v4();
    await _writeMetaValue(db, 'device_id', generated);
    return generated;
  }

  Future<String> getApiBaseUrl() async {
    final db = await database;
    final stored = await _readMetaValue(db, _apiBaseUrlMetaKey);
    final normalized = _normalizeApiBaseUrl(stored);

    // If a build-time URL is injected via --dart-define, always use it.
    // This prevents the app from getting stuck on a previously saved LAN IP.
    const buildTimeUrl = String.fromEnvironment('J1_API_BASE_URL');
    if (buildTimeUrl.isNotEmpty) {
      return buildTimeUrl;
    }

    return normalized ?? AppConstants.apiBaseUrl;
  }

  Future<void> setApiBaseUrl(String value) async {
    final db = await database;
    final normalized = _normalizeApiBaseUrl(value);

    if (normalized == null) {
      throw Exception('Enter a valid API base URL');
    }

    await _writeMetaValue(db, _apiBaseUrlMetaKey, normalized);
  }

  Future<void> clearApiBaseUrl() async {
    final db = await database;
    await db.delete(
      metaTable,
      where: 'meta_key = ?',
      whereArgs: [_apiBaseUrlMetaKey],
    );
  }

  String? _normalizeApiBaseUrl(String? value) {
    final trimmed = value?.trim();
    if (trimmed == null || trimmed.isEmpty) {
      return null;
    }

    final candidate = trimmed.contains('://') ? trimmed : 'http://$trimmed';
    final uri = Uri.tryParse(candidate);
    if (uri == null || uri.host.isEmpty || uri.scheme.isEmpty) {
      return null;
    }

      // Remove path, query, and fragment to get clean base URL
      final clean = uri
          .replace(path: '', query: '', fragment: '')
          .toString()
          .replaceAll(RegExp(r'/$'), '');
    
      // Extra safety: remove any trailing ? or # that might have been left
      return clean.replaceAll(RegExp(r'[?#]+$'), '');
  }

  Future<String?> _readMetaValue(Database db, String key) async {
    final result = await db.query(
      metaTable,
      where: 'meta_key = ?',
      whereArgs: [key],
      limit: 1,
    );

    if (result.isEmpty) {
      return null;
    }

    return result.first['meta_value']?.toString();
  }

  Future<void> _writeMetaValue(Database db, String key, String value) async {
    await db.insert(
      metaTable,
      {
        'meta_key': key,
        'meta_value': value,
      },
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  Future<int> saveEvent(EventModel event) async {
    final db = await database;
    final columns = await _getEventColumns();
    final values = _buildEventInsertMap(event, columns);

    if (event.eventId.trim().isEmpty) {
      throw Exception('Event ID is required');
    }
    if (event.userId.trim().isEmpty) {
      throw Exception('User ID is required');
    }
    if (event.deviceId.trim().isEmpty) {
      throw Exception('Device ID is required');
    }

    return await db.insert(
      AppConstants.eventsTable,
      values,
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  Future<EventModel?> findEventBySignature({
    required String eventType,
    required String userId,
    required String payload,
  }) async {
    final db = await database;
    final columns = await _getEventColumns();
    final typeColumn = _pickColumn(columns, ['event_type', 'type']) ?? 'event_type';
    final userColumn = _pickColumn(columns, ['user_id', 'userId']) ?? 'user_id';
    final createdColumn = _pickColumn(columns, ['created_at', 'createdAt']) ?? 'created_at';
    final result = await db.query(
      AppConstants.eventsTable,
      where: '''
        $typeColumn = ? AND
        $userColumn = ? AND
        payload = ? AND
        status IN (?, ?)
      ''',
      whereArgs: [
        eventType,
        userId,
        payload,
        AppConstants.statusQueued,
        AppConstants.statusSubmitted,
      ],
      orderBy: '$createdColumn DESC',
      limit: 1,
    );

    if (result.isEmpty) {
      return null;
    }

    return EventModel.fromMap(result.first);
  }

  Future<List<EventModel>> getQueuedEvents() async {
    final db = await database;
    final columns = await _getEventColumns();
    final createdColumn = _pickColumn(columns, ['created_at', 'createdAt']) ?? 'created_at';

    final result = await db.query(
      AppConstants.eventsTable,
      where: 'status = ?',
      whereArgs: [AppConstants.statusQueued],
      orderBy: '$createdColumn ASC',
    );

    return result.map((map) => EventModel.fromMap(map)).toList();
  }

  Future<List<EventModel>> getSubmittedEvents() async {
    final db = await database;
    final columns = await _getEventColumns();
    final submittedColumn = _pickColumn(columns, ['submitted_at', 'submittedAt']) ?? 'submitted_at';

    final result = await db.query(
      AppConstants.eventsTable,
      where: 'status = ?',
      whereArgs: [AppConstants.statusSubmitted],
      orderBy: '$submittedColumn DESC',
    );

    return result.map((map) => EventModel.fromMap(map)).toList();
  }

  Future<List<EventModel>> getAllEvents() async {
    final db = await database;
    final columns = await _getEventColumns();
    final createdColumn = _pickColumn(columns, ['created_at', 'createdAt']) ?? 'created_at';

    final result = await db.query(
      AppConstants.eventsTable,
      orderBy: '$createdColumn DESC',
    );

    return result.map((map) => EventModel.fromMap(map)).toList();
  }

  Future<List<RequestModel>> getRequests({String? userId}) async {
    final events = await getAllEvents();
    final filtered = userId == null
        ? events
        : events.where((event) => event.userId == userId).toList();
    return filtered.map(RequestModel.fromEvent).toList();
  }

  Future<int> updateEventStatus({
    required String eventId,
    required String status,
    String? submittedAt,
    String? lastSyncError,
    int? syncAttempts,
  }) async {
    final db = await database;
    final columns = await _getEventColumns();
    final submittedColumn = _pickColumn(columns, ['submitted_at', 'submittedAt']) ?? 'submitted_at';
    final errorColumn = _pickColumn(columns, ['last_sync_error', 'lastSyncError']) ?? 'last_sync_error';
    final attemptsColumn = _pickColumn(columns, ['sync_attempts', 'syncAttempts']) ?? 'sync_attempts';

    final updateData = {
      'status': status,
      if (submittedAt != null) submittedColumn: submittedAt,
      if (lastSyncError != null) errorColumn: lastSyncError,
      if (syncAttempts != null) attemptsColumn: syncAttempts,
    };

    return await db.update(
      AppConstants.eventsTable,
      updateData,
      where: 'event_id = ?',
      whereArgs: [eventId],
    );
  }

  Future<void> resetQueuedEventAttempts() async {
    final db = await database;
    await db.rawUpdate('''
      UPDATE ${AppConstants.eventsTable}
      SET sync_attempts = 0, last_sync_error = NULL
      WHERE status = ?
    ''', [AppConstants.statusQueued]);
  }

  Future<int> incrementSyncAttempts(String eventId, {String? error}) async {
    final db = await database;
    final columns = await _getEventColumns();
    final errorColumn = _pickColumn(columns, ['last_sync_error', 'lastSyncError']) ?? 'last_sync_error';
    return await db.rawUpdate(
      '''
      UPDATE ${AppConstants.eventsTable}
      SET sync_attempts = sync_attempts + 1,
          $errorColumn = ?,
          last_sync_at = CURRENT_TIMESTAMP
      WHERE event_id = ?
      ''',
      [error, eventId],
    );
  }

  Future<int> getQueueCount() async {
    final db = await database;

    final result = await db.rawQuery(
      '''
      SELECT COUNT(*) as count
      FROM ${AppConstants.eventsTable}
      WHERE status = ?
      ''',
      [AppConstants.statusQueued],
    );

    return Sqflite.firstIntValue(result) ?? 0;
  }

  Future<int> deleteEvent(String eventId) async {
    final db = await database;

    return await db.delete(
      AppConstants.eventsTable,
      where: 'event_id = ?',
      whereArgs: [eventId],
    );
  }

  Future<int> clearAllEvents() async {
    final db = await database;
    return await db.delete(AppConstants.eventsTable);
  }

  Future<void> closeDatabase() async {
    final db = await database;
    await db.close();
    _database = null;
  }

  Future<Set<String>> _getEventColumns() async {
    if (_eventsColumns != null && _eventsColumns!.isNotEmpty) {
      return _eventsColumns!;
    }

    final db = await database;
    _eventsColumns = await _getTableColumns(db, AppConstants.eventsTable);
    return _eventsColumns!;
  }

  String? _pickColumn(Set<String> columns, List<String> candidates) {
    for (final candidate in candidates) {
      if (columns.contains(candidate)) {
        return candidate;
      }
    }
    return null;
  }

  Map<String, dynamic> _buildEventInsertMap(EventModel event, Set<String> columns) {
    final values = <String, dynamic>{
      'event_id': event.eventId,
      'payload': event.data,
      'status': event.status,
    };

    if (columns.contains('event_type')) {
      values['event_type'] = event.type;
    }
    if (columns.contains('type')) {
      values['type'] = event.type;
    }

    if (columns.contains('created_at')) {
      values['created_at'] = event.createdAt;
    }
    if (columns.contains('createdAt')) {
      values['createdAt'] = event.createdAt;
    }

    if (columns.contains('submitted_at')) {
      values['submitted_at'] = event.submittedAt;
    }
    if (columns.contains('submittedAt')) {
      values['submittedAt'] = event.submittedAt;
    }

    if (columns.contains('claimed_by_user_id')) {
      values['claimed_by_user_id'] = event.claimedByUserId;
    }
    if (columns.contains('claimedByUserId')) {
      values['claimedByUserId'] = event.claimedByUserId;
    }

    if (columns.contains('claimed_by_user_name')) {
      values['claimed_by_user_name'] = event.claimedByUserName;
    }
    if (columns.contains('claimedByUserName')) {
      values['claimedByUserName'] = event.claimedByUserName;
    }

    if (columns.contains('claimed_at')) {
      values['claimed_at'] = event.claimedAt;
    }
    if (columns.contains('claimedAt')) {
      values['claimedAt'] = event.claimedAt;
    }

    if (columns.contains('user_id')) {
      values['user_id'] = event.userId;
    }
    if (columns.contains('userId')) {
      values['userId'] = event.userId;
    }

    if (columns.contains('device_id')) {
      values['device_id'] = event.deviceId;
    }
    if (columns.contains('deviceId')) {
      values['deviceId'] = event.deviceId;
    }

    if (columns.contains('event_version')) {
      values['event_version'] = event.eventVersion;
    }
    if (columns.contains('eventVersion')) {
      values['eventVersion'] = event.eventVersion;
    }

    if (columns.contains('sync_attempts')) {
      values['sync_attempts'] = event.syncAttempts;
    }
    if (columns.contains('syncAttempts')) {
      values['syncAttempts'] = event.syncAttempts;
    }

    if (columns.contains('last_sync_error')) {
      values['last_sync_error'] = event.lastSyncError;
    }
    if (columns.contains('lastSyncError')) {
      values['lastSyncError'] = event.lastSyncError;
    }

    if (columns.contains('last_sync_at')) {
      values['last_sync_at'] = event.lastSyncAt;
    }
    if (columns.contains('lastSyncAt')) {
      values['lastSyncAt'] = event.lastSyncAt;
    }

    if (columns.contains('metadata')) {
      values['metadata'] = event.metadata.isEmpty ? '{}' : event.toMap()['metadata'];
    }

    return values;
  }

  Map<String, dynamic> _decodeMetadata(dynamic metadata) {
    if (metadata == null) {
      return {};
    }
    if (metadata is Map<String, dynamic>) {
      return metadata;
    }
    try {
      final decoded = jsonDecode(metadata.toString());
      if (decoded is Map<String, dynamic>) {
        return decoded;
      }
    } catch (_) {
      // Fall through to an empty map.
    }
    return {};
  }

  /// Create resources table for caching backend resources
  Future<void> _createResourcesTable(Database db) async {
    await db.execute('''
      CREATE TABLE IF NOT EXISTS resources (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        district TEXT NOT NULL,
        status TEXT NOT NULL,
        latitude REAL,
        longitude REAL,
        capacity INTEGER,
        current_load INTEGER,
        last_updated TEXT NOT NULL
      )
    ''');

    // Create indexes for common queries
    await db.execute('CREATE INDEX IF NOT EXISTS idx_resources_status ON resources(status)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_resources_district ON resources(district)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_resources_type ON resources(type)');
  }

  /// Ensure resources table exists (for schema migrations)
  Future<void> _ensureResourcesSchema(Database db) async {
    final existingColumns = await _getTableColumns(db, 'resources');
    
    if (existingColumns.isEmpty) {
      // Table doesn't exist, create it
      await _createResourcesTable(db);
      return;
    }

    // Table exists, verify it has all required columns
    final requiredColumns = <String>[
      'id',
      'type',
      'name',
      'district',
      'status',
      'latitude',
      'longitude',
      'capacity',
      'current_load',
      'last_updated',
    ];

    final missingColumns = requiredColumns
        .where((column) => !existingColumns.contains(column))
        .toList();

    // Add any missing columns
    for (final column in missingColumns) {
      final definition = switch (column) {
        'id' => 'TEXT PRIMARY KEY',
        'type' => 'TEXT NOT NULL',
        'name' => 'TEXT NOT NULL',
        'district' => 'TEXT NOT NULL',
        'status' => 'TEXT NOT NULL',
        'latitude' => 'REAL',
        'longitude' => 'REAL',
        'capacity' => 'INTEGER',
        'current_load' => 'INTEGER',
        'last_updated' => 'TEXT NOT NULL',
        _ => 'TEXT',
      };

      try {
        await db.execute(
          'ALTER TABLE resources ADD COLUMN $column $definition',
        );
      } catch (e) {
        // Column might already exist, ignore error
      }
    }

    // Ensure indexes exist
    await db.execute('CREATE INDEX IF NOT EXISTS idx_resources_status ON resources(status)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_resources_district ON resources(district)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_resources_type ON resources(type)');
  }

  /// Save/cache resources from backend API
  Future<void> saveResources(List<ResourceModel> resources) async {
    final db = await database;
    
    try {
      // Ensure table exists
      await _ensureResourcesSchema(db);
      
      for (final resource in resources) {
        await db.insert(
          'resources',
          resource.toMap(),
          conflictAlgorithm: ConflictAlgorithm.replace,
        );
      }
    } catch (e) {
      print('DatabaseHelper: Error saving resources: $e');
      rethrow;
    }
  }

  /// Get all cached resources from SQLite
  Future<List<ResourceModel>> getResources() async {
    final db = await database;
    
    try {
      // Ensure table exists
      await _ensureResourcesSchema(db);
      
      final result = await db.query(
        'resources',
        orderBy: 'district ASC, name ASC',
      );

      return result.map(ResourceModel.fromMap).toList();
    } catch (e) {
      print('DatabaseHelper: Error getting resources: $e');
      return [];
    }
  }

  /// Get resources by type
  Future<List<ResourceModel>> getResourcesByType(ResourceType type) async {
    final db = await database;
    
    try {
      // Ensure table exists
      await _ensureResourcesSchema(db);
      
      final typeString = ResourceModel.typeToString(type);
      final result = await db.query(
        'resources',
        where: 'type = ?',
        whereArgs: [typeString],
        orderBy: 'district ASC, name ASC',
      );

      return result.map(ResourceModel.fromMap).toList();
    } catch (e) {
      print('DatabaseHelper: Error getting resources by type: $e');
      return [];
    }
  }

  /// Get resources by district
  Future<List<ResourceModel>> getResourcesByDistrict(String district) async {
    final db = await database;
    
    try {
      // Ensure table exists
      await _ensureResourcesSchema(db);
      
      final result = await db.query(
        'resources',
        where: 'district = ?',
        whereArgs: [district],
        orderBy: 'name ASC',
      );

      return result.map(ResourceModel.fromMap).toList();
    } catch (e) {
      print('DatabaseHelper: Error getting resources by district: $e');
      return [];
    }
  }

  /// Get available resources (AVAILABLE status only)
  Future<List<ResourceModel>> getAvailableResources() async {
    final db = await database;
    
    try {
      // Ensure table exists
      await _ensureResourcesSchema(db);
      
      final statusString = ResourceModel.statusToString(ResourceStatus.AVAILABLE);
      final result = await db.query(
        'resources',
        where: 'status = ?',
        whereArgs: [statusString],
        orderBy: 'district ASC, name ASC',
      );

      return result.map(ResourceModel.fromMap).toList();
    } catch (e) {
      print('DatabaseHelper: Error getting available resources: $e');
      return [];
    }
  }

  /// Get available resources by district
  Future<List<ResourceModel>> getAvailableResourcesByDistrict(String district) async {
    final db = await database;
    
    try {
      // Ensure table exists
      await _ensureResourcesSchema(db);
      
      final statusString = ResourceModel.statusToString(ResourceStatus.AVAILABLE);
      final result = await db.query(
        'resources',
        where: 'status = ? AND district = ?',
        whereArgs: [statusString, district],
        orderBy: 'name ASC',
      );

      return result.map(ResourceModel.fromMap).toList();
    } catch (e) {
      print('DatabaseHelper: Error getting available resources by district: $e');
      return [];
    }
  }

  /// Get count of resources
  Future<int> getResourcesCount() async {
    final db = await database;
    
    try {
      // Ensure table exists
      await _ensureResourcesSchema(db);
      
      final result = await db.rawQuery(
        'SELECT COUNT(*) as count FROM resources',
      );

      return Sqflite.firstIntValue(result) ?? 0;
    } catch (e) {
      print('DatabaseHelper: Error getting resources count: $e');
      return 0;
    }
  }

  /// Clear all cached resources
  Future<int> clearResources() async {
    final db = await database;
    
    try {
      // Ensure table exists
      await _ensureResourcesSchema(db);
      
      return await db.delete('resources');
    } catch (e) {
      print('DatabaseHelper: Error clearing resources: $e');
      return 0;
    }
  }

  /// Delete a single resource
  Future<int> deleteResource(String resourceId) async {
    final db = await database;
    
    try {
      // Ensure table exists
      await _ensureResourcesSchema(db);
      
      return await db.delete(
        'resources',
        where: 'id = ?',
        whereArgs: [resourceId],
      );
    } catch (e) {
      print('DatabaseHelper: Error deleting resource: $e');
      return 0;
    }
  }
}

