import 'package:flutter/foundation.dart';
import 'package:uuid/uuid.dart';

import '../models/app_user.dart';
import 'database_helper.dart';

class AuthService {
  AuthService._internal();

  static final AuthService instance = AuthService._internal();

  final ValueNotifier<AppUser?> currentUserNotifier = ValueNotifier<AppUser?>(null);

  DatabaseHelper get _db => DatabaseHelper.instance;

  static const String mockEmail = 'mock.user@j1.local';
  static const String mockPassword = 'mock1234';
  static const String mockName = 'Mock User';

  AppUser? get currentUser => currentUserNotifier.value;

  Future<void> initialize() async {
    await _db.database;
    final sessionUser = await _db.getSessionUser();
    currentUserNotifier.value = sessionUser;
  }

  Future<AppUser> register({
    required String name,
    required String email,
    required String password,
  }) async {
    final normalizedEmail = email.trim().toLowerCase();
    if (name.trim().isEmpty) {
      throw Exception('Enter your name');
    }
    if (normalizedEmail.isEmpty || !normalizedEmail.contains('@')) {
      throw Exception('Enter a valid email');
    }
    if (password.trim().length < 6) {
      throw Exception('Password must be at least 6 characters');
    }

    final existing = await _db.getUserByEmail(normalizedEmail);
    if (existing != null) {
      throw Exception('An account already exists for this email');
    }

    final user = AppUser(
      id: const Uuid().v4(),
      name: name.trim(),
      email: normalizedEmail,
      password: password,
      role: 'PUBLIC_USER',
      isMock: false,
      createdAt: DateTime.now().toUtc().toIso8601String(),
    );

    await _db.insertUser(user);
    await _db.setCurrentSession(user.id);
    currentUserNotifier.value = user;
    return user;
  }

  Future<AppUser> login({
    required String email,
    required String password,
  }) async {
    final normalizedEmail = email.trim().toLowerCase();
    final user = await _db.getUserByEmail(normalizedEmail);
    if (user == null) {
      throw Exception('No account found for that email');
    }
    if (user.password != password) {
      throw Exception('Incorrect password');
    }

    final updatedUser = AppUser(
      id: user.id,
      name: user.name,
      email: user.email,
      password: user.password,
      role: user.role,
      isMock: user.isMock,
      createdAt: user.createdAt,
      lastLoginAt: DateTime.now().toUtc().toIso8601String(),
    );

    await _db.updateUserLastLogin(updatedUser);
    await _db.setCurrentSession(updatedUser.id);
    currentUserNotifier.value = updatedUser;
    return updatedUser;
  }

  Future<AppUser> loginWithMockUser() async {
    await _db.ensureMockUser();
    return login(
      email: mockEmail,
      password: mockPassword,
    );
  }

  Future<void> logout() async {
    await _db.clearCurrentSession();
    currentUserNotifier.value = null;
  }

  Future<String> getDeviceId() {
    return _db.getDeviceId();
  }

  Future<AppUser?> getActiveUser() async {
    return _db.getSessionUser();
  }

  Future<List<AppUser>> getAllUsers() {
    return _db.getUsers();
  }
}
