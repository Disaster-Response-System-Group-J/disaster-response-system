/// Authentication service used by the mobile Field Officer app.
/// Currently uses an in-memory credential store and a lightweight
/// session model. Replace with secure API calls and token storage
/// when integrating with the backend.
import '../models/user.dart';

class AuthService {
  /// Valid credential pairs: Service ID → Passkey
  static const Map<String, String> _validCredentials = {
    'CMD-049': 'admin123',
    'LOG-012': 'logistics123',
    'ADM-001': 'superadmin',
    // Field officers
    'FO-A01': 'zonea001',
    'FO-B02': 'zoneb002',
  };

  /// Maps Service IDs to their designated roles and zones
  static const Map<String, Map<String, String>> _profileMap = {
    'CMD-049': {'role': 'OFFICER', 'zone': 'ZONE-A'},
    'LOG-012': {'role': 'LOGISTICS', 'zone': 'LOGISTICS'},
    'ADM-001': {'role': 'ADMIN', 'zone': 'NATIONAL'},
    'FO-A01': {'role': 'OFFICER', 'zone': 'ZONE-A'},
    'FO-B02': {'role': 'OFFICER', 'zone': 'ZONE-B'},
  };

  /// The currently authenticated user (in-memory session).
  /// Use a proper secure storage for production.
  static User? currentUser;

  /// Attempts authentication and returns a `User` on success,
  /// otherwise returns `null`.
  static User? authenticate(String serviceId, String passkey) {
    final id = serviceId.trim().toUpperCase();
    final key = passkey.trim();

    final valid = _validCredentials[id] == key;
    if (!valid) return null;

    final profile = _profileMap[id] ?? {'role': 'UNKNOWN', 'zone': 'UNKNOWN'};
    final user = User(serviceId: id, role: profile['role']!, zone: profile['zone']!);
    currentUser = user;
    return user;
  }

  /// Clears the in-memory session.
  static void signOut() {
    currentUser = null;
  }
}
