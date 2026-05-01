import 'package:path/path.dart';
import 'package:sqflite/sqflite.dart';

import '../utils/constants.dart';
import '../models/event_model.dart';

class DatabaseHelper {
  static final DatabaseHelper instance = DatabaseHelper._internal();

  static Database? _database;

  DatabaseHelper._internal();

  Future<Database> get database async {
    if (_database != null) {
      return _database!;
    }

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

    Future<List<EventModel>> getAllEvents() async {
    final db = await database;

    final result = await db.query(
      AppConstants.eventsTable,
      orderBy: 'timestamp_created DESC',
    );

    return result.map((map) => EventModel.fromMap(map)).toList();
  }
}