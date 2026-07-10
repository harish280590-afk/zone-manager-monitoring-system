import 'dart:convert';

class SessionUser {
  final String uid;
  final String empId;
  final String name;
  final String role; // 'Admin' | 'Zone Manager'
  final String email;

  SessionUser({
    required this.uid,
    required this.empId,
    required this.name,
    required this.role,
    required this.email,
  });

  Map<String, dynamic> toMap() {
    return {
      'uid': uid,
      'empId': empId,
      'name': name,
      'role': role,
      'email': email,
    };
  }

  factory SessionUser.fromMap(Map<String, dynamic> map) {
    return SessionUser(
      uid: map['uid'] ?? '',
      empId: map['empId'] ?? '',
      name: map['name'] ?? '',
      role: map['role'] ?? '',
      email: map['email'] ?? '',
    );
  }

  String toJson() => json.encode(toMap());

  factory SessionUser.fromJson(String source) => SessionUser.fromMap(json.decode(source));
}
