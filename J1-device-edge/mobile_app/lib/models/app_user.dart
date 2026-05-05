class AppUser {
  final String id;
  final String name;
  final String email;
  final String password;
  final String role;
  final bool isMock;
  final String createdAt;
  final String? lastLoginAt;

  const AppUser({
    required this.id,
    required this.name,
    required this.email,
    required this.password,
    required this.role,
    required this.isMock,
    required this.createdAt,
    this.lastLoginAt,
  });

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'name': name,
      'email': email,
      'password': password,
      'role': role,
      'is_mock': isMock ? 1 : 0,
      'created_at': createdAt,
      'last_login_at': lastLoginAt,
    };
  }

  factory AppUser.fromMap(Map<String, dynamic> map) {
    return AppUser(
      id: map['id']?.toString() ?? '',
      name: map['name']?.toString() ?? '',
      email: map['email']?.toString() ?? '',
      password: map['password']?.toString() ?? '',
      role: map['role']?.toString() ?? 'PUBLIC_USER',
      isMock: (map['is_mock'] ?? 0) == 1,
      createdAt: map['created_at']?.toString() ?? '',
      lastLoginAt: map['last_login_at']?.toString(),
    );
  }
}
