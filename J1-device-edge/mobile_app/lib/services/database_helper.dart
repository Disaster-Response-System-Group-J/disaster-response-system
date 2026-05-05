import 'dart:convert';

import 'package:path/path.dart';
import 'package:sqflite/sqflite.dart';
import 'package:uuid/uuid.dart';

import '../models/app_user.dart';
import '../utills/constants.dart';
import '../models/event_model.dart';
import '../models/request_model.dart';

class DatabaseHelper {
  static final DatabaseHelper instance = DatabaseHelper._internal();

  static Database? _database;
  Set<String>? _eventsColumns;
  static const String usersTable = 'users';
  static const String sessionTable = 'auth_session';
  static const String metaTable = 'app_meta';

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
    await _ensureSeedData(db);
    return db;
  }

  Future<void> _onCreate(Database db, int version) async {
    await _createAuthTables(db);
    await _createEventsTable(db);
    await _ensureSeedData(db);
  }

  Future<void> _onUpgrade(Database db, int oldVersion, int newVersion) async {
    if (oldVersion < 2) {
      await _createAuthTables(db);
    }

    await _ensureEventsSchema(db);

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
        sync_attempts INTEGER DEFAULT 0,
        last_sync_error TEXT,
        last_sync_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        submitted_at DATETIME,
        CHECK (status IN ('QUEUED', 'SUBMITTED', 'FAILED', 'DUPLICATE'))
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

    await _ensureDemoHelpRequests(db);
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

  Future<void> _ensureDemoHelpRequests(Database db) async {
    final existingDemo = await db.query(
      AppConstants.eventsTable,
      where: 'event_id IN (?, ?)',
      whereArgs: [
        'demo-help-request-1',
        'demo-help-request-2',
      ],
      limit: 1,
    );
    if (existingDemo.isNotEmpty) {
      return;
    }

    await _ensureDemoUser(
      db,
      userId: 'demo-user-1',
      name: 'Nimal Fernando',
      email: 'nimal.demo@j1.local',
    );
    await _ensureDemoUser(
      db,
      userId: 'demo-user-2',
      name: 'Ayesha Perera',
      email: 'ayesha.demo@j1.local',
    );

    final demoDeviceId = await _getOrCreateDeviceId(db);

    final demoEvents = <EventModel>[
      EventModel(
        eventId: 'demo-help-request-1',
        type: 'HELP_REQUEST',
        data: '{"request_type":"Medical help","description":"Need medicine and first aid support near the school","people_count":2,"mobility_support_required":false,"injuries_reported":true,"location":"Kandy"}',
        status: AppConstants.statusQueued,
        createdAt: '2026-05-05T00:00:00Z',
        submittedAt: null,
        userId: 'demo-user-1',
        deviceId: demoDeviceId,
        metadata: const {'seeded': true, 'source': 'demo'},
        eventVersion: '1.0',
        lastSyncAt: null,
      ),
      EventModel(
        eventId: 'demo-help-request-2',
        type: 'HELP_REQUEST',
        data: '{"request_type":"Water supply","description":"Requesting drinking water for families in the area","people_count":5,"mobility_support_required":false,"injuries_reported":false,"location":"Galle"}',
        status: AppConstants.statusQueued,
        createdAt: '2026-05-05T00:05:00Z',
        submittedAt: null,
        userId: 'demo-user-2',
        deviceId: demoDeviceId,
        metadata: const {'seeded': true, 'source': 'demo'},
        eventVersion: '1.0',
        lastSyncAt: null,
      ),
    ];

    for (final event in demoEvents) {
      await db.insert(
        AppConstants.eventsTable,
        event.toMap(),
        conflictAlgorithm: ConflictAlgorithm.ignore,
      );
    }
  }

  Future<void> _ensureDemoUser(
    Database db, {
    required String userId,
    required String name,
    required String email,
  }) async {
    final result = await db.query(
      usersTable,
      where: 'id = ? OR email = ?',
      whereArgs: [userId, email],
      limit: 1,
    );

    if (result.isNotEmpty) {
      return;
    }

    final demoUser = AppUser(
      id: userId,
      name: name,
      email: email,
      password: 'demo1234',
      role: 'PUBLIC_USER',
      isMock: true,
      createdAt: DateTime.now().toUtc().toIso8601String(),
    );

    await db.insert(
      usersTable,
      demoUser.toMap(),
      conflictAlgorithm: ConflictAlgorithm.ignore,
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

  Future<String> _getOrCreateDeviceId(Database db) async {
    final existing = await _readMetaValue(db, 'device_id');
    if (existing != null && existing.isNotEmpty) {
      return existing;
    }

    final generated = const Uuid().v4();
    await _writeMetaValue(db, 'device_id', generated);
    return generated;
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

  Future<List<EventModel>> getHelpRequests({
    String? excludeUserId,
  }) async {
    final events = await getQueuedEvents();
    return events.where((event) {
      if (event.type != 'HELP_REQUEST') {
        return false;
      }
      if (excludeUserId == null || excludeUserId.isEmpty) {
        return true;
      }
      return event.userId != excludeUserId;
    }).toList();
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
}
