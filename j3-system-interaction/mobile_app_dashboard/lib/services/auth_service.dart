/// Static authentication service with hardcoded credentials.
/// Replace this with actual API calls when the backend is ready.
class AuthService {
  /// Valid credential pairs: Service ID → Passkey
  static const Map<String, String> _validCredentials = {
    'CMD-049': 'admin123',
    'LOG-012': 'logistics123',
    'ADM-001': 'superadmin',
  };

  /// Maps Service IDs to their designated roles
  static const Map<String, String> _roleMap = {
    'CMD-049': 'OFFICER',
    'LOG-012': 'LOGISTICS',
    'ADM-001': 'ADMIN',
  };

  /// Attempts login with the given credentials.
  /// Returns `true` if valid, `false` otherwise.
  static bool login(String serviceId, String passkey) {
    final trimmedId = serviceId.trim().toUpperCase();
    final trimmedKey = passkey.trim();
    return _validCredentials[trimmedId] == trimmedKey;
  }

  /// Returns the role for a given Service ID, or 'UNKNOWN' if not found.
  static String getRole(String serviceId) {
    return _roleMap[serviceId.trim().toUpperCase()] ?? 'UNKNOWN';
  }
}
