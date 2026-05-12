import 'dart:convert';
import 'package:http/http.dart' as http;

import '../models/app_user.dart';
import '../utills/constants.dart';

class UserService {
  UserService._internal();

  static final UserService instance = UserService._internal();

  /// Fetch user profile from /api/me endpoint
  Future<AppUser> fetchUserProfile(String token, AppUser currentUser) async {
    try {
      final baseUrl = AppConstants.apiBaseUrl;
      final uri = Uri.parse('$baseUrl/api/me');

      print('[UserService] Fetching user profile from $uri');

      final response = await http.get(
        uri,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      ).timeout(
        const Duration(seconds: 10),
        onTimeout: () => throw Exception('Request timed out'),
      );

      print('[UserService] Response status: ${response.statusCode}');
      print('[UserService] Response body: ${response.body}');

      if (response.statusCode == 200) {
        final responseData = jsonDecode(response.body);

        if (responseData is! Map<String, dynamic>) {
          throw Exception('Invalid response format from server');
        }

        // Update user with data from /api/me
        final updatedUser = AppUser(
          id: currentUser.id,
          name: responseData['name']?.toString() ?? currentUser.name,
          email: responseData['email']?.toString() ?? currentUser.email,
          password: currentUser.password,
          role: responseData['role']?.toString() ?? currentUser.role,
          isMock: currentUser.isMock,
          createdAt: currentUser.createdAt,
          lastLoginAt: currentUser.lastLoginAt,
          token: currentUser.token,
          serviceId: responseData['serviceId']?.toString(),
          zone: responseData['zone']?.toString(),
        );

        print('[UserService] ✅ User profile fetched successfully');
        return updatedUser;
      } else if (response.statusCode == 401) {
        throw Exception('Unauthorized - please login again');
      } else {
        final responseData = jsonDecode(response.body);
        final errorMessage = responseData['error']?.toString() ?? 'Failed to fetch user profile';
        throw Exception(errorMessage);
      }
    } catch (e) {
      print('[UserService] ❌ Error fetching user profile: $e');
      rethrow;
    }
  }
}
