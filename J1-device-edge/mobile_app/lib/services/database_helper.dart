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

    await _ensureSeedData(db);
    return db;
  }

  Future<void> _onCreate(Database db, int version) async {
    await _createAuthTables(db);

    await db.execute('''
      CREATE TABLE ${AppConstants.eventsTable} (
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

    await db.execute('CREATE INDEX idx_events_status ON ${AppConstants.eventsTable}(status)');
    await db.execute('CREATE INDEX idx_events_user_id ON ${AppConstants.eventsTable}(user_id)');
    await db.execute('CREATE INDEX idx_events_created_at ON ${AppConstants.eventsTable}(created_at DESC)');
    await db.execute('CREATE INDEX idx_events_event_id ON ${AppConstants.eventsTable}(event_id)');

    await _ensureSeedData(db);
  }

  Future<void> _onUpgrade(Database db, int oldVersion, int newVersion) async {
    if (oldVersion < 2) {
      await _createAuthTables(db);
    }

    await _ensureSeedData(db);
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
    final existing = await _readMetaValue('device_id');
    if (existing != null && existing.isNotEmpty) {
      return existing;
    }

    final generated = const Uuid().v4();
    await _writeMetaValue('device_id', generated);
    return generated;
  }

  Future<String?> _readMetaValue(String key) async {
    final db = await database;
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

  Future<void> _writeMetaValue(String key, String value) async {
    final db = await database;
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

    return await db.insert(
      AppConstants.eventsTable,
      event.toMap(),
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  Future<List<EventModel>> getQueuedEvents() async {
    final db = await database;

    final result = await db.query(
      AppConstants.eventsTable,
      where: 'status = ?',
      whereArgs: [AppConstants.statusQueued],
      orderBy: 'created_at ASC',
    );

    return result.map((map) => EventModel.fromMap(map)).toList();
  }

  Future<List<EventModel>> getSubmittedEvents() async {
    final db = await database;

    final result = await db.query(
      AppConstants.eventsTable,
      where: 'status = ?',
      whereArgs: [AppConstants.statusSubmitted],
      orderBy: 'submitted_at DESC',
    );

    return result.map((map) => EventModel.fromMap(map)).toList();
  }

  Future<List<EventModel>> getAllEvents() async {
    final db = await database;

    final result = await db.query(
      AppConstants.eventsTable,
      orderBy: 'created_at DESC',
    );

    return result.map((map) => EventModel.fromMap(map)).toList();
  }

  Future<List<RequestModel>> getRequests() async {
    final events = await getAllEvents();
    return events.map(RequestModel.fromEvent).toList();
  }

  Future<int> updateEventStatus({
    required String eventId,
    required String status,
    String? submittedAt,
    String? lastSyncError,
    int? syncAttempts,
  }) async {
    final db = await database;

    final updateData = {
      'status': status,
      if (submittedAt != null) 'submitted_at': submittedAt,
      if (lastSyncError != null) 'last_sync_error': lastSyncError,
      if (syncAttempts != null) 'sync_attempts': syncAttempts,
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
    return await db.rawUpdate(
      '''
      UPDATE ${AppConstants.eventsTable}
      SET sync_attempts = sync_attempts + 1,
          last_sync_error = ?,
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
}
