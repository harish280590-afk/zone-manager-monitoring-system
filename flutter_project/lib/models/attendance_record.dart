import 'dart:convert';

class AttendanceRecord {
  final String id;
  final String empId;
  final String name;
  final String date;
  final String checkInTime;
  final double checkInLat;
  final double checkInLng;
  final String checkInAddress;
  final String checkInSelfie;
  final String? checkOutTime;
  final double? checkOutLat;
  final double? checkOutLng;
  final String? checkOutAddress;
  final String? checkOutSelfie;
  final double? workingHours;
  final String status; // 'Checked In' | 'Checked Out'

  AttendanceRecord({
    required this.id,
    required this.empId,
    required this.name,
    required this.date,
    required this.checkInTime,
    required this.checkInLat,
    required this.checkInLng,
    required this.checkInAddress,
    required this.checkInSelfie,
    this.checkOutTime,
    this.checkOutLat,
    this.checkOutLng,
    this.checkOutAddress,
    this.checkOutSelfie,
    this.workingHours,
    required this.status,
  });

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'empId': empId,
      'name': name,
      'date': date,
      'checkInTime': checkInTime,
      'checkInLat': checkInLat,
      'checkInLng': checkInLng,
      'checkInAddress': checkInAddress,
      'checkInSelfie': checkInSelfie,
      'checkOutTime': checkOutTime,
      'checkOutLat': checkOutLat,
      'checkOutLng': checkOutLng,
      'checkOutAddress': checkOutAddress,
      'checkOutSelfie': checkOutSelfie,
      'workingHours': workingHours,
      'status': status,
    };
  }

  factory AttendanceRecord.fromMap(Map<String, dynamic> map) {
    return AttendanceRecord(
      id: map['id'] ?? '',
      empId: map['empId'] ?? '',
      name: map['name'] ?? '',
      date: map['date'] ?? '',
      checkInTime: map['checkInTime'] ?? '',
      checkInLat: (map['checkInLat'] as num?)?.toDouble() ?? 0.0,
      checkInLng: (map['checkInLng'] as num?)?.toDouble() ?? 0.0,
      checkInAddress: map['checkInAddress'] ?? '',
      checkInSelfie: map['checkInSelfie'] ?? '',
      checkOutTime: map['checkOutTime'],
      checkOutLat: (map['checkOutLat'] as num?)?.toDouble(),
      checkOutLng: (map['checkOutLng'] as num?)?.toDouble(),
      checkOutAddress: map['checkOutAddress'],
      checkOutSelfie: map['checkOutSelfie'],
      workingHours: (map['workingHours'] as num?)?.toDouble(),
      status: map['status'] ?? 'Checked In',
    );
  }

  String toJson() => json.encode(toMap());

  factory AttendanceRecord.fromJson(String source) => AttendanceRecord.fromMap(json.decode(source));
}
