import 'package:path/path.dart';
import 'package:sqflite/sqflite.dart';

import '../utills/constants.dart';
import '../models/confirmed_incident_model.dart';
import '../models/event_model.dart';
import '../models/incoming_report_model.dart';
import '../models/request_model.dart';

class DatabaseHelper {
  static final DatabaseHelper instance = DatabaseHelper._internal();

  static Database? _database;

  DatabaseHelper._internal();

  Future<Database> get database async {
    if (_database != null) return _database!;

    _database = await _initDatabase();
    return _database!;
  }

  Future<Database> _initDatabase() async {
    final databasePath = await getDatabasesPath();
    final path = join(databasePath, AppConstants.databaseName);

    return await openDatabase(
      path,
      version: AppConstants.databaseVersion,
      onCreate: _onCreate,
      onUpgrade: _onUpgrade,
    );
  }

  Future<void> _onCreate(Database db, int version) async {
    await db.execute('''
      CREATE TABLE ${AppConstants.eventsTable} (
        event_id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        data TEXT NOT NULL,
        status TEXT NOT NULL,
        timestamp_created TEXT NOT NULL,
        timestamp_submitted TEXT
      )
    ''');
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

    await db.execute('''
      CREATE TABLE ${AppConstants.usersTable} (
        user_id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    ''');

    await db.execute('''
      CREATE TABLE ${AppConstants.incomingReportsTable} (
        id TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        disaster_type TEXT NOT NULL,
        district TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        description TEXT NOT NULL,
        contact TEXT,
        media_urls TEXT NOT NULL,
        verification_status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        reviewed_at TEXT,
        officer_notes TEXT,
        sos_id TEXT,
        device_id TEXT,
        reviewed_by_id TEXT,
        incident_id TEXT,
        timestamp_submitted TEXT,
        FOREIGN KEY (reviewed_by_id) REFERENCES ${AppConstants.usersTable} (user_id) ON DELETE SET NULL,
        FOREIGN KEY (incident_id) REFERENCES ${AppConstants.confirmedIncidentsTable} (id) ON DELETE SET NULL
      )
    ''');

    await db.execute('''
      CREATE TABLE ${AppConstants.confirmedIncidentsTable} (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        disaster_type TEXT NOT NULL,
        district TEXT NOT NULL,
        severity TEXT NOT NULL,
        status TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        description TEXT NOT NULL,
        public_visibility INTEGER NOT NULL DEFAULT 1,
        affected_people INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    ''');

    await db.execute('''
      CREATE TABLE ${AppConstants.resourcesTable} (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        district TEXT NOT NULL,
        status TEXT NOT NULL,
        latitude REAL,
        longitude REAL,
        capacity INTEGER,
        current_load INTEGER,
        last_updated TEXT NOT NULL,
        incident_id TEXT,
        synced INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (incident_id) REFERENCES ${AppConstants.confirmedIncidentsTable} (id) ON DELETE SET NULL
      )
    ''');

    await db.execute('''
      CREATE TABLE ${AppConstants.alertsTable} (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        severity TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        district TEXT NOT NULL,
        is_public INTEGER NOT NULL DEFAULT 0,
        is_active INTEGER NOT NULL DEFAULT 1,
        source TEXT,
        created_at TEXT NOT NULL,
        expires_at TEXT
      )
    ''');

    await db.execute('''
      CREATE TABLE ${AppConstants.syncMetadataTable} (
        record_id TEXT PRIMARY KEY,
        record_type TEXT NOT NULL,
        sync_status TEXT NOT NULL,
        last_sync_attempt TEXT,
        sync_error_message TEXT,
        retry_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
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
      orderBy: 'timestamp_created ASC',
    );

    return result.map((map) => EventModel.fromMap(map)).toList();
  }

  Future<List<EventModel>> getSubmittedEvents() async {
    final db = await database;

    final result = await db.query(
      AppConstants.eventsTable,
      where: 'status = ?',
      whereArgs: [AppConstants.statusSubmitted],
      orderBy: 'timestamp_submitted DESC',
    );

    return result.map((map) => EventModel.fromMap(map)).toList();
  }

  Future<List<EventModel>> getAllEvents() async {
    final db = await database;

    final result = await db.query(
      AppConstants.eventsTable,
      orderBy: 'timestamp_created DESC',
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
    String? timestampSubmitted,
  }) async {
    final db = await database;

    return await db.update(
      AppConstants.eventsTable,
      {
        'status': status,
        'timestamp_submitted': timestampSubmitted,
      },
      where: 'event_id = ?',
      whereArgs: [eventId],
    );
  }

  Future<int> saveIncomingReport(IncomingReportModel report) async {
    final db = await database;

    return await db.insert(
      AppConstants.incomingReportsTable,
      _incomingReportDbMap(report),
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  Future<IncomingReportModel?> getIncomingReportById(String id) async {
    final db = await database;

    final result = await db.query(
      AppConstants.incomingReportsTable,
      where: 'id = ?',
      whereArgs: [id],
      limit: 1,
    );

    if (result.isEmpty) {
      return null;
    }

    return IncomingReportModel.fromMap(result.first);
  }

  Future<List<IncomingReportModel>> getAllIncomingReports() async {
    final db = await database;

    final result = await db.query(
      AppConstants.incomingReportsTable,
      orderBy: 'created_at DESC',
    );

    return result.map((map) => IncomingReportModel.fromMap(map)).toList();
  }

  Future<List<IncomingReportModel>> getIncomingReportsByStatus(String verificationStatus) async {
    final db = await database;

    final result = await db.query(
      AppConstants.incomingReportsTable,
      where: 'verification_status = ?',
      whereArgs: [verificationStatus],
      orderBy: 'created_at DESC',
    );

    return result.map((map) => IncomingReportModel.fromMap(map)).toList();
  }

  Future<int> updateIncomingReport(IncomingReportModel report) async {
    final db = await database;

    return await db.update(
      AppConstants.incomingReportsTable,
      _incomingReportDbMap(report),
      where: 'id = ?',
      whereArgs: [report.id],
    );
  }

  Future<int> deleteIncomingReport(String id) async {
    final db = await database;

    return await db.delete(
      AppConstants.incomingReportsTable,
      where: 'id = ?',
      whereArgs: [id],
    );
  }

  Future<int> saveConfirmedIncident(ConfirmedIncidentModel incident) async {
    final db = await database;

    return await db.insert(
      AppConstants.confirmedIncidentsTable,
      _confirmedIncidentDbMap(incident),
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  Future<ConfirmedIncidentModel?> getConfirmedIncidentById(String id) async {
    final db = await database;

    final result = await db.query(
      AppConstants.confirmedIncidentsTable,
      where: 'id = ?',
      whereArgs: [id],
      limit: 1,
    );

    if (result.isEmpty) {
      return null;
    }

    return ConfirmedIncidentModel.fromMap(result.first);
  }

  Future<List<ConfirmedIncidentModel>> getAllConfirmedIncidents() async {
    final db = await database;

    final result = await db.query(
      AppConstants.confirmedIncidentsTable,
      orderBy: 'created_at DESC',
    );

    return result.map((map) => ConfirmedIncidentModel.fromMap(map)).toList();
  }

  Future<List<ConfirmedIncidentModel>> getConfirmedIncidentsByStatus(String status) async {
    final db = await database;

    final result = await db.query(
      AppConstants.confirmedIncidentsTable,
      where: 'status = ?',
      whereArgs: [status],
      orderBy: 'created_at DESC',
    );

    return result.map((map) => ConfirmedIncidentModel.fromMap(map)).toList();
  }

  Future<int> updateConfirmedIncident(ConfirmedIncidentModel incident) async {
    final db = await database;

    return await db.update(
      AppConstants.confirmedIncidentsTable,
      _confirmedIncidentDbMap(incident),
      where: 'id = ?',
      whereArgs: [incident.id],
    );
  }

  Future<int> deleteConfirmedIncident(String id) async {
    final db = await database;

    return await db.delete(
      AppConstants.confirmedIncidentsTable,
      where: 'id = ?',
      whereArgs: [id],
    );
  }

  Map<String, dynamic> _incomingReportDbMap(IncomingReportModel report) {
    final map = Map<String, dynamic>.from(report.toMap());
    map['id'] = map.remove('report_id') ?? report.id;
    return map;
  }

  Map<String, dynamic> _confirmedIncidentDbMap(ConfirmedIncidentModel incident) {
    final map = Map<String, dynamic>.from(incident.toMap());
    map['id'] = map.remove('incident_id') ?? incident.id;
    return map;
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