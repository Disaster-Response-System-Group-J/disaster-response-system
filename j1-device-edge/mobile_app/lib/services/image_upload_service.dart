import 'dart:io';
import 'package:http/http.dart' as http;
import 'dart:convert';

import '../utills/constants.dart';
import 'database_helper.dart';

class ImageUploadService {
  /// Upload a single image file to the J1 bridge /api/v1/upload endpoint.
  /// Returns the public Supabase URL on success, or null on failure.
  /// Does not throw; logs errors and continues.
  static Future<String?> uploadImage(File imageFile) async {
    if (!imageFile.existsSync()) {
      print('Error: Image file not found: ${imageFile.path}');
      return null;
    }

    try {
      final baseUrl = await DatabaseHelper.instance.getApiBaseUrl();
      final uploadUrl = Uri.parse('$baseUrl${AppConstants.apiUploadEndpoint}');

      final request = http.MultipartRequest('POST', uploadUrl);

      final fileStream = http.ByteStream(imageFile.openRead());
      final fileLength = await imageFile.length();
      final multipartFile = http.MultipartFile(
        'files',
        fileStream,
        fileLength,
        filename: imageFile.path.split('/').last,
      );
      request.files.add(multipartFile);

      print('Uploading image to $uploadUrl');

      final response = await request.send().timeout(
            const Duration(seconds: 60),
          );

      final responseString = await response.stream.bytesToString();
      print('Upload response: HTTP ${response.statusCode}');

      if (response.statusCode == 200) {
        final json = jsonDecode(responseString) as Map<String, dynamic>;
        final success = json['success'] as bool? ?? false;

        if (success) {
          final data = json['data'] as Map<String, dynamic>?;
          final urls = data?['urls'] as List<dynamic>? ?? [];
          if (urls.isNotEmpty) {
            final url = urls.first.toString();
            print('Upload successful; received URL: $url');
            return url;
          }
        }
      }

      print('Upload failed or returned no URL. Response: $responseString');
      return null;
    } catch (e) {
      print('ImageUploadService error: $e');
      return null;
    }
  }
}
