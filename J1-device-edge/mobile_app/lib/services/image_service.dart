import 'dart:io';
import 'dart:typed_data';

import 'package:image/image.dart' as img;

class ImageService {
  static Future<Uint8List?> compressImageFile(
    File file, {
    int quality = 75,
    int maxDimension = 1600,
  }) async {
    final bytes = await file.readAsBytes();
    final decoded = img.decodeImage(bytes);

    if (decoded == null) {
      return null;
    }

    final resized = decoded.width > decoded.height
        ? img.copyResize(decoded, width: maxDimension)
        : img.copyResize(decoded, height: maxDimension);

    final encoded = img.encodeJpg(resized, quality: quality);
    return Uint8List.fromList(encoded);
  }

  static String formatSize(int byteCount) {
    if (byteCount < 1024) {
      return '$byteCount B';
    }

    if (byteCount < 1024 * 1024) {
      return '${(byteCount / 1024).toStringAsFixed(1)} KB';
    }

    return '${(byteCount / (1024 * 1024)).toStringAsFixed(1)} MB';
  }
}
