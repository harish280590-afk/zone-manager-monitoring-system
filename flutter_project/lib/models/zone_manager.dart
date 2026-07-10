import 'dart:convert';

class PathPoint {
  final double lat;
  final double lng;
  final String timestamp;
  final double speed;
  final int battery;
  final String network;

  PathPoint({
    required this.lat,
    required this.lng,
    required this.timestamp,
    required this.speed,
    required this.battery,
    required this.network,
  });

  Map<String, dynamic> toMap() {
    return {
      'lat': lat,
      'lng': lng,
      'timestamp': timestamp,
      'speed': speed,
      'battery': battery,
      'network': network,
    };
  }

  factory PathPoint.fromMap(Map<String, dynamic> map) {
    return PathPoint(
      lat: (map['lat'] as num?)?.toDouble() ?? 0.0,
      lng: (map['lng'] as num?)?.toDouble() ?? 0.0,
      timestamp: map['timestamp'] ?? '',
      speed: (map['speed'] as num?)?.toDouble() ?? 0.0,
      battery: (map['battery'] as num?)?.toInt() ?? 100,
      network: map['network'] ?? 'Good',
    );
  }
}

class VisitedPlace {
  final String name;
  final String arrival;
  final String departure;
  final int durationMin;
  final double distancePrev;

  VisitedPlace({
    required this.name,
    required this.arrival,
    required this.departure,
    required this.durationMin,
    required this.distancePrev,
  });

  Map<String, dynamic> toMap() {
    return {
      'name': name,
      'arrival': arrival,
      'departure': departure,
      'durationMin': durationMin,
      'distancePrev': distancePrev,
    };
  }

  factory VisitedPlace.fromMap(Map<String, dynamic> map) {
    return VisitedPlace(
      name: map['name'] ?? '',
      arrival: map['arrival'] ?? '',
      departure: map['departure'] ?? '',
      durationMin: (map['durationMin'] as num?)?.toInt() ?? 0,
      distancePrev: (map['distancePrev'] as num?)?.toDouble() ?? 0.0,
    );
  }
}

class ZoneManager {
  final String id;
  final String name;
  final String phone;
  final String empId;
  final String zone;
  final List<int> wards;
  final double baseLat;
  final double baseLng;
  final String status; // 'checked-in' | 'checked-out'
  final int battery;
  final String batteryStatus;
  final String network;
  final double speed;
  final String lastUpdate;
  final double currentLat;
  final double currentLng;
  final String currentAddress;
  final double distanceTravelledKm;
  final double workingHours;
  final int idleTimeMin;
  final int totalStops;
  final bool sos;
  final List<PathPoint> pathHistory;
  final List<VisitedPlace> visitedPlaces;

  ZoneManager({
    required this.id,
    required this.name,
    required this.phone,
    required this.empId,
    required this.zone,
    required this.wards,
    required this.baseLat,
    required this.baseLng,
    required this.status,
    required this.battery,
    required this.batteryStatus,
    required this.network,
    required this.speed,
    required this.lastUpdate,
    required this.currentLat,
    required this.currentLng,
    required this.currentAddress,
    required this.distanceTravelledKm,
    required this.workingHours,
    required this.idleTimeMin,
    required this.totalStops,
    required this.sos,
    required this.pathHistory,
    required this.visitedPlaces,
  });

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'name': name,
      'phone': phone,
      'empId': empId,
      'zone': zone,
      'wards': wards,
      'baseLat': baseLat,
      'baseLng': baseLng,
      'status': status,
      'battery': battery,
      'batteryStatus': batteryStatus,
      'network': network,
      'speed': speed,
      'lastUpdate': lastUpdate,
      'currentLat': currentLat,
      'currentLng': currentLng,
      'currentAddress': currentAddress,
      'distanceTravelledKm': distanceTravelledKm,
      'workingHours': workingHours,
      'idleTimeMin': idleTimeMin,
      'totalStops': totalStops,
      'sos': sos,
      'pathHistory': pathHistory.map((p) => p.toMap()).toList(),
      'visitedPlaces': visitedPlaces.map((v) => v.toMap()).toList(),
    };
  }

  factory ZoneManager.fromMap(Map<String, dynamic> map) {
    return ZoneManager(
      id: map['id'] ?? '',
      name: map['name'] ?? '',
      phone: map['phone'] ?? '',
      empId: map['empId'] ?? '',
      zone: map['zone'] ?? '',
      wards: List<int>.from(map['wards'] ?? []),
      baseLat: (map['baseLat'] as num?)?.toDouble() ?? 0.0,
      baseLng: (map['baseLng'] as num?)?.toDouble() ?? 0.0,
      status: map['status'] ?? 'checked-out',
      battery: (map['battery'] as num?)?.toInt() ?? 100,
      batteryStatus: map['batteryStatus'] ?? 'Charging',
      network: map['network'] ?? 'Good',
      speed: (map['speed'] as num?)?.toDouble() ?? 0.0,
      lastUpdate: map['lastUpdate'] ?? '',
      currentLat: (map['currentLat'] as num?)?.toDouble() ?? 0.0,
      currentLng: (map['currentLng'] as num?)?.toDouble() ?? 0.0,
      currentAddress: map['currentAddress'] ?? '',
      distanceTravelledKm: (map['distanceTravelledKm'] as num?)?.toDouble() ?? 0.0,
      workingHours: (map['workingHours'] as num?)?.toDouble() ?? 0.0,
      idleTimeMin: (map['idleTimeMin'] as num?)?.toInt() ?? 0,
      totalStops: (map['totalStops'] as num?)?.toInt() ?? 0,
      sos: map['sos'] ?? false,
      pathHistory: (map['pathHistory'] as List?)
              ?.map((item) => PathPoint.fromMap(Map<String, dynamic>.from(item)))
              .toList() ??
          [],
      visitedPlaces: (map['visitedPlaces'] as List?)
              ?.map((item) => VisitedPlace.fromMap(Map<String, dynamic>.from(item)))
              .toList() ??
          [],
    );
  }

  String toJson() => json.encode(toMap());

  factory ZoneManager.fromJson(String source) => ZoneManager.fromMap(json.decode(source));
}
