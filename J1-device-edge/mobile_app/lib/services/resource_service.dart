/// Resource Service for managing disaster response resources
/// Handles fetching resources from backend API and caching them locally in SQLite
/// Supports offline-first architecture with fallback to cached data

import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;

import '../models/resource_model.dart';
import '../utills/constants.dart';
import 'database_helper.dart';
import 'network_service.dart';

class ResourceService {
  static final ResourceService instance = ResourceService._internal();
  
  static const String _logTag = 'ResourceService';
  static const Duration _networkTimeout = Duration(seconds: 15);
  static const String _resourcesEndpoint = '/api/v1/resources';

  final DatabaseHelper _db = DatabaseHelper.instance;

  ResourceService._internal();

  /// Fetch resources from backend and cache them locally
  /// Returns cached resources if network is unavailable
  Future<List<ResourceModel>> fetchAndCacheResources({bool forceRefresh = false}) async {
    try {
      // Check network connectivity
      final isOnline = await NetworkService.isOnline();
      
      if (!isOnline) {
        // Offline: load cached resources
        return await _getCachedResources();
      }

      // Online: fetch from backend
      try {
        final resources = await _fetchFromBackend();
        
        // Cache resources locally
        if (resources.isNotEmpty) {
          await _db.saveResources(resources);
        }
        
        return resources;
      } catch (e) {
        // Fetch failed: fallback to cached resources
        print('$_logTag: Failed to fetch resources from backend: $e');
        return await _getCachedResources();
      }
    } catch (e) {
      print('$_logTag: Error in fetchAndCacheResources: $e');
      return [];
    }
  }

  /// Fetch resources from backend API
  Future<List<ResourceModel>> _fetchFromBackend() async {
    try {
      final url = Uri.parse('${AppConstants.apiBaseUrl}$_resourcesEndpoint');
      
      final response = await http.get(
        url,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      ).timeout(_networkTimeout);

      if (response.statusCode == 200) {
        final dynamic responseBody = jsonDecode(response.body);
        
        // Handle both array and object responses
        late List<dynamic> resourcesData;
        if (responseBody is List) {
          resourcesData = responseBody;
        } else if (responseBody is Map && responseBody.containsKey('data')) {
          resourcesData = responseBody['data'] as List? ?? [];
        } else {
          print('$_logTag: Unexpected response format');
          return [];
        }

        return resourcesData
            .map((json) {
              try {
                return ResourceModel.fromJson(json as Map<String, dynamic>);
              } catch (e) {
                print('$_logTag: Failed to parse resource: $e');
                return null;
              }
            })
            .whereType<ResourceModel>()
            .toList();
      } else if (response.statusCode == 401 || response.statusCode == 403) {
        throw Exception('Unauthorized: ${response.statusCode}');
      } else {
        throw Exception('Failed to fetch resources: ${response.statusCode}');
      }
    } catch (e) {
      print('$_logTag: Backend fetch error: $e');
      rethrow;
    }
  }

  /// Get cached resources from SQLite
  Future<List<ResourceModel>> _getCachedResources() async {
    try {
      return await _db.getResources();
    } catch (e) {
      print('$_logTag: Error getting cached resources: $e');
      return [];
    }
  }

  /// Get all resources (from cache)
  Future<List<ResourceModel>> getResources() async {
    try {
      return await _db.getResources();
    } catch (e) {
      print('$_logTag: Error getting resources: $e');
      return [];
    }
  }

  /// Get available resources (from cache)
  Future<List<ResourceModel>> getAvailableResources() async {
    try {
      return await _db.getAvailableResources();
    } catch (e) {
      print('$_logTag: Error getting available resources: $e');
      return [];
    }
  }

  /// Get resources by type (from cache)
  Future<List<ResourceModel>> getResourcesByType(ResourceType type) async {
    try {
      return await _db.getResourcesByType(type);
    } catch (e) {
      print('$_logTag: Error getting resources by type: $e');
      return [];
    }
  }

  /// Get resources by district (from cache)
  Future<List<ResourceModel>> getResourcesByDistrict(String district) async {
    try {
      return await _db.getResourcesByDistrict(district);
    } catch (e) {
      print('$_logTag: Error getting resources by district: $e');
      return [];
    }
  }

  /// Get available resources by district (from cache)
  Future<List<ResourceModel>> getAvailableResourcesByDistrict(String district) async {
    try {
      return await _db.getAvailableResourcesByDistrict(district);
    } catch (e) {
      print('$_logTag: Error getting available resources by district: $e');
      return [];
    }
  }

  /// Clear cached resources
  Future<void> clearCachedResources() async {
    try {
      await _db.clearResources();
    } catch (e) {
      print('$_logTag: Error clearing cached resources: $e');
    }
  }

  /// Get resource count
  Future<int> getResourcesCount() async {
    try {
      return await _db.getResourcesCount();
    } catch (e) {
      print('$_logTag: Error getting resources count: $e');
      return 0;
    }
  }

  /// Check if resources cache is empty
  Future<bool> isCacheEmpty() async {
    try {
      final count = await getResourcesCount();
      return count == 0;
    } catch (e) {
      print('$_logTag: Error checking cache: $e');
      return true;
    }
  }
}
