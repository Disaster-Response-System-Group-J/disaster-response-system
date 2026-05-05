import 'enums.dart';

class UserModel {
  final String id;
  final String email;
  final String name;
  final UserRole role;
  final DateTime createdAt;

  UserModel({
    required this.id,
    required this.email,
    required this.name,
    required this.role,
    required this.createdAt,
  }) {
    if (email.isEmpty || !email.contains('@')) {
      throw ArgumentError('Invalid email: $email');
    }
  }

  Map<String, dynamic> toMap() {
    return {
      'user_id': id,
      'email': email,
      'name': name,
      'role': role.toApiValue(),
      'created_at': createdAt.toUtc().toIso8601String(),
    };
  }

  factory UserModel.fromMap(Map<String, dynamic> map) {
    return UserModel(
      id: map['user_id'] as String,
      email: map['email'] as String,
      name: map['name'] as String,
      role: UserRole.fromApiValue(map['role'] as String? ?? 'PUBLIC_USER'),
      createdAt: DateTime.parse(map['created_at'] as String),
    );
  }

  UserModel copyWith({
    String? id,
    String? email,
    String? name,
    UserRole? role,
    DateTime? createdAt,
  }) {
    return UserModel(
      id: id ?? this.id,
      email: email ?? this.email,
      name: name ?? this.name,
      role: role ?? this.role,
      createdAt: createdAt ?? this.createdAt,
    );
  }

  @override
  String toString() {
    return 'UserModel{id: $id, email: $email, name: $name, role: ${role.toApiValue()}, createdAt: ${createdAt.toUtc().toIso8601String()}}';
  }
}
