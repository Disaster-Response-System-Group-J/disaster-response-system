import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:uuid/uuid.dart';

import '../models/app_user.dart';
import '../utills/constants.dart';
import 'database_helper.dart';
import 'user_service.dart';

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
    
    if (sessionUser != null && sessionUser.token != null) {
      // Try to refresh user profile from /api/me
      try {
        print('[AuthService] Refreshing user profile from /api/me');
        final refreshedUser = await UserService.instance.fetchUserProfile(sessionUser.token!, sessionUser);
        await _db.updateUserLastLogin(refreshedUser);
        currentUserNotifier.value = refreshedUser;
        print('[AuthService] ✅ User profile refreshed on app start');
      } catch (e) {
        print('[AuthService] ⚠️  Failed to refresh profile on startup: $e');
        // If refresh fails, still load the local session
        currentUserNotifier.value = sessionUser;
      }
    } else {
      currentUserNotifier.value = sessionUser;
    }
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
    
    if (normalizedEmail.isEmpty || !normalizedEmail.contains('@')) {
      throw Exception('Enter a valid email');
    }
    if (password.isEmpty) {
      throw Exception('Enter your password');
    }

    try {
      // Make API call to login endpoint
      final baseUrl = AppConstants.apiBaseUrl;
      final uri = Uri.parse('$baseUrl${AppConstants.apiLoginEndpoint}');
      
      print('[AuthService] Attempting login to $uri with email: $normalizedEmail');

      final response = await http.post(
        uri,
        headers: {
          'Content-Type': 'application/json',
        },
        body: jsonEncode({
          'email': normalizedEmail,
          'password': password,
        }),
      ).timeout(
        const Duration(seconds: 10),
        onTimeout: () => throw Exception('Login request timed out. Check your connection.'),
      );

      print('[AuthService] Login response status: ${response.statusCode}');
      print('[AuthService] Login response body: ${response.body}');

      if (response.statusCode == 200) {
        final responseData = jsonDecode(response.body);
        
        if (responseData is! Map<String, dynamic>) {
          throw Exception('Invalid response format from server');
        }

        final message = responseData['message']?.toString() ?? 'Login successful';
        final token = responseData['token']?.toString();

        if (token == null || token.isEmpty) {
          throw Exception('No authentication token received from server');
        }

        // Create or get user object with token
        // Try to get existing user from local DB first
        AppUser? localUser = await _db.getUserByEmail(normalizedEmail);
        
        if (localUser == null) {
          // Create new user locally if doesn't exist
          localUser = AppUser(
            id: const Uuid().v4(),
            name: responseData['name']?.toString() ?? normalizedEmail.split('@')[0],
            email: normalizedEmail,
            password: password,
            role: responseData['role']?.toString() ?? 'PUBLIC_USER',
            isMock: false,
            createdAt: DateTime.now().toUtc().toIso8601String(),
            token: token,
          );
          await _db.insertUser(localUser);
        } else {
          // Update existing user with token
          localUser = AppUser(
            id: localUser.id,
            name: localUser.name,
            email: localUser.email,
            password: password,
            role: localUser.role,
            isMock: localUser.isMock,
            createdAt: localUser.createdAt,
            lastLoginAt: DateTime.now().toUtc().toIso8601String(),
            token: token,
          );
          await _db.updateUserLastLogin(localUser);
        }

        await _db.setCurrentSession(localUser.id);
        currentUserNotifier.value = localUser;

        // Fetch user profile from /api/me to get additional info
        try {
          final userProfile = await UserService.instance.fetchUserProfile(token, localUser);
          await _db.updateUserLastLogin(userProfile);
          currentUserNotifier.value = userProfile;
          localUser = userProfile;
        } catch (e) {
          print('[AuthService] ⚠️  Failed to fetch user profile: $e');
          // Continue even if profile fetch fails, user is already logged in
        }

        print('[AuthService] ✅ Login successful: $message');
        return localUser;
      } else if (response.statusCode == 401) {
        throw Exception('Invalid email or password');
      } else if (response.statusCode == 404) {
        throw Exception('User account not found');
      } else {
        final responseData = jsonDecode(response.body);
        final errorMessage = responseData['message']?.toString() ?? 'Login failed';
        throw Exception(errorMessage);
      }
    } catch (e) {
      print('[AuthService] ❌ Login error: $e');
      rethrow;
    }
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
