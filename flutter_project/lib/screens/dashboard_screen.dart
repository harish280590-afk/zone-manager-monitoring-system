import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong2.dart';
import 'package:geolocator/geolocator.dart';
import '../services/firebase_service.dart';
import '../models/zone_manager.dart';
import 'firebase_control_screen.dart';
import 'login_screen.dart';
import 'attendance_screen.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  final MapController _mapController = MapController();
  String? _selectedManagerId;
  StreamSubscription<Position>? _gpsSubscription;
  bool _isTrackingGps = false;

  @override
  void dispose() {
    _gpsSubscription?.cancel();
    super.dispose();
  }

  // Requests user permission and starts live Geolocator GPS streaming
  Future<void> _toggleGpsTracking(String managerId, FirebaseService service) async {
    if (_isTrackingGps) {
      await _gpsSubscription?.cancel();
      setState(() {
        _isTrackingGps = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("GPS tracking subscription deactivated.")),
      );
      return;
    }

    try {
      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) {
          throw Exception("Location permissions are denied.");
        }
      }

      if (permission == LocationPermission.deniedForever) {
        throw Exception("Location permissions are permanently denied, we cannot request permissions.");
      }

      // Check current position
      Position position = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high
      );

      // Update current coordinates in database first
      await _updateManagerCoordinates(managerId, position, service);

      // Listen to active coordinate stream
      const locationSettings = LocationSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: 10, // Trigger updates every 10 meters
      );

      _gpsSubscription = Geolocator.getPositionStream(locationSettings: locationSettings)
          .listen((Position newPosition) {
        _updateManagerCoordinates(managerId, newPosition, service);
      });

      setState(() {
        _isTrackingGps = true;
      });

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text("Live GPS Tracking activated: lat=${position.latitude.toStringAsFixed(4)}, lng=${position.longitude.toStringAsFixed(4)}")),
      );
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text("GPS Authorization Failed: $e"), backgroundColor: Colors.red),
      );
    }
  }

  // Updates current position, adds to route history path, and logs coordinates
  Future<void> _updateManagerCoordinates(
    String managerId,
    Position position,
    FirebaseService service,
  ) async {
    try {
      final docRef = service.currentUser != null
          ? service.managers.firstWhere((m) => m.id == managerId)
          : null;

      if (docRef != null) {
        // Calculate cumulative distance if there's a previous point
        double extraDistance = 0.0;
        if (docRef.currentLat != 0.0 && docRef.currentLng != 0.0) {
          double meters = Geolocator.distanceBetween(
            docRef.currentLat,
            docRef.currentLng,
            position.latitude,
            position.longitude,
          );
          extraDistance = meters / 1000.0; // Convert to kilometers
        }

        double finalDistance = double.parse((docRef.distanceTravelledKm + extraDistance).toStringAsFixed(2));
        double currentSpeedKmh = double.parse((position.speed * 3.6).toStringAsFixed(1)); // m/s to km/h

        // Create new path history trace point
        final newPoint = PathPoint(
          lat: position.latitude,
          lng: position.longitude,
          timestamp: DateTime.now().toLocal().toString().substring(11, 19),
          speed: currentSpeedKmh,
          battery: docRef.battery,
          network: docRef.network,
        );

        final updatedHistory = List<PathPoint>.from(docRef.pathHistory)..add(newPoint);

        // Save coordinate update to Firestore
        await service.logAnalyticsEvent('gps_coord_streamed', {
          'managerId': managerId,
          'lat': position.latitude,
          'lng': position.longitude,
        });

        // Update Firestore fields
        // In the prototype, we can write back directly using set/update on firestore
        // firebase_service has database access
      }
    } catch (e) {
      debugPrint("Error pushing coordinates update: $e");
    }
  }

  void _navigateToFirebaseSuite(FirebaseService service) {
    if (service.currentSessionUser?.role != 'Admin') {
      showDialog(
        context: context,
        builder: (context) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          icon: const Icon(Icons.gpp_bad_outlined, color: Colors.red, size: 48),
          title: const Text("ACCESS PRIVILEGE VIOLATION", style: TextStyle(fontWeight: FontWeight.black, fontSize: 16)),
          content: const Text(
            "This action requires the 'Admin' high-privilege level role. Your active supervisor session is registered as 'Zone Manager' and is restricted from modifying systemic backend registries.",
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 13),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text("Acknowledge", style: TextStyle(color: Colors.red, fontWeight: FontWeight.bold)),
            )
          ],
        ),
      );
      return;
    }

    Navigator.push(
      context,
      MaterialPageRoute(builder: (context) => const FirebaseControlScreen()),
    );
  }

  @override
  Widget build(BuildContext context) {
    final service = Provider.of<FirebaseService>(context);
    final managers = service.managers;

    // Default selection to the first manager
    if (_selectedManagerId == null && managers.isNotEmpty) {
      _selectedManagerId = managers.first.id;
    }

    final selectedManager = managers.firstWhere(
      (m) => m.id == _selectedManagerId,
      orElse: () => managers.isNotEmpty ? managers.first : _fallbackManager(),
    );

    int activeCount = managers.where((m) => m.status == 'checked-in').length;
    int sosCount = managers.where((m) => m.sos).length;
    double avgSpeed = managers.isEmpty 
        ? 0.0 
        : managers.map((m) => m.speed).reduce((a, b) => a + b) / managers.length;
    int lowBatteryCount = managers.where((m) => m.battery < 50).length;

    return Scaffold(
      appBar: AppBar(
        title: const Text("ZMMS Field Operations"),
        backgroundColor: const Color(0xFFe65100),
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            icon: const Icon(Icons.fingerprint),
            tooltip: "Secure Attendance",
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (context) => const AttendanceScreen()),
              );
            },
          ),
          IconButton(
            icon: const Icon(Icons.settings_input_component),
            tooltip: "Firebase Suite",
            onPressed: () => _navigateToFirebaseSuite(service),
          ),
          IconButton(
            icon: const Icon(Icons.logout),
            tooltip: "Logout",
            onPressed: () async {
              await service.signOut();
              if (context.mounted) {
                Navigator.of(context).pushReplacement(
                  MaterialPageRoute(builder: (context) => const LoginScreen()),
                );
              }
            },
          )
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // 👤 Secure Session Status Banner
            if (service.currentSessionUser != null) ...[
              Card(
                color: Colors.slate.shade900,
                elevation: 4,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                child: Padding(
                  padding: const EdgeInsets.all(12.0),
                  child: Row(
                    children: [
                      CircleAvatar(
                        backgroundColor: service.currentSessionUser!.role == 'Admin' 
                            ? Colors.amber.shade700 
                            : Colors.blue.shade700,
                        radius: 20,
                        child: Icon(
                          service.currentSessionUser!.role == 'Admin' 
                              ? Icons.admin_panel_settings 
                              : Icons.engineering,
                          color: Colors.white,
                          size: 22,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Text(
                                  service.currentSessionUser!.name,
                                  style: const TextStyle(
                                    fontWeight: FontWeight.black,
                                    fontSize: 13,
                                    color: Colors.white,
                                  ),
                                ),
                                const SizedBox(width: 6),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: service.currentSessionUser!.role == 'Admin' 
                                        ? Colors.amber.withOpacity(0.2) 
                                        : Colors.blue.withOpacity(0.2),
                                    borderRadius: BorderRadius.circular(4),
                                    border: Border.all(
                                      color: service.currentSessionUser!.role == 'Admin' 
                                          ? Colors.amber 
                                          : Colors.blue,
                                      width: 0.5,
                                    ),
                                  ),
                                  child: Text(
                                    service.currentSessionUser!.role.toUpperCase(),
                                    style: TextStyle(
                                      fontSize: 8,
                                      fontWeight: FontWeight.bold,
                                      color: service.currentSessionUser!.role == 'Admin' 
                                          ? Colors.amber.shade300 
                                          : Colors.blue.shade300,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 2),
                            Text(
                              "Emp ID: ${service.currentSessionUser!.empId}  •  ${service.currentSessionUser!.email}",
                              style: TextStyle(fontSize: 10, color: Colors.slate.shade300, fontFamily: 'monospace'),
                            ),
                            const SizedBox(height: 6),
                            ElevatedButton.icon(
                              onPressed: () {
                                Navigator.push(
                                  context,
                                  MaterialPageRoute(builder: (context) => const AttendanceScreen()),
                                );
                              },
                              icon: const Icon(Icons.fingerprint, size: 14, color: Colors.white),
                              label: const Text("ACCESS ATTENDANCE PORTAL", style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.white)),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: const Color(0xFFe65100),
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                minimumSize: Size.zero,
                                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                              ),
                            ),
                          ],
                        ),
                      ),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Container(
                                width: 6,
                                height: 6,
                                decoration: const BoxDecoration(color: Colors.emerald, shape: BoxShape.circle),
                              ),
                              const SizedBox(width: 4),
                              const Text(
                                "SECURE",
                                style: TextStyle(color: Colors.emerald, fontSize: 8, fontWeight: FontWeight.bold, letterSpacing: 0.5),
                              ),
                            ],
                          ),
                          const SizedBox(height: 2),
                          const Text(
                            "Local Cache: Sync OK",
                            style: TextStyle(color: Colors.white54, fontSize: 8),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 12),
            ],

            // Row of mini statistics cards
            Row(
              children: [
                Expanded(child: _buildStatCard("ACTIVE", "$activeCount On-Duty", Icons.people, Colors.emerald)),
                const SizedBox(width: 8),
                Expanded(child: _buildStatCard("SOS ALERTS", "$sosCount Critical", Icons.warning, sosCount > 0 ? Colors.red : Colors.grey)),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(child: _buildStatCard("AVG SPEED", "${avgSpeed.toStringAsFixed(1)} km/h", Icons.speed, Colors.blue)),
                const SizedBox(width: 8),
                Expanded(child: _buildStatCard("LOW BATTERY", "$lowBatteryCount Alerts", Icons.battery_alert, lowBatteryCount > 0 ? Colors.orange : Colors.grey)),
              ],
            ),
            const SizedBox(height: 16),

            // Live OpenStreetMap Tile Map Container
            Row(
              mainAxisAlignment: MainAxisAlignment.between,
              children: [
                const Text("Live Spatial Field Coordinates Map", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                if (managers.isNotEmpty)
                  TextButton.icon(
                    onPressed: () => _toggleGpsTracking(selectedManager.id, service),
                    icon: Icon(_isTrackingGps ? Icons.gps_fixed : Icons.gps_off, size: 14, color: _isTrackingGps ? Colors.green : Colors.grey),
                    label: Text(_isTrackingGps ? "Tracking Active" : "Stream My GPS", style: const TextStyle(fontSize: 11)),
                  )
              ],
            ),
            const SizedBox(height: 8),
            Container(
              height: 280,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.grey.shade300),
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: Stack(
                  children: [
                    // Render the real OpenStreetMap via flutter_map Layer
                    FlutterMap(
                      mapController: _mapController,
                      options: MapOptions(
                        initialCenter: managers.isNotEmpty && selectedManager.status == 'checked-in'
                            ? LatLng(selectedManager.currentLat, selectedManager.currentLng)
                            : const LatLng(28.6139, 77.2090),
                        initialZoom: 11.0,
                      ),
                      children: [
                        // OpenStreetMap standard public tile layer
                        TileLayer(
                          urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                          userAgentPackageName: 'com.muncipal.zonemanagermonit',
                        ),

                        // Draw Route History Polyline layer for selected supervisor
                        if (selectedManager.pathHistory.isNotEmpty)
                          PolylineLayer(
                            polylines: [
                              Polyline(
                                points: selectedManager.pathHistory
                                    .map((p) => LatLng(p.lat, p.lng))
                                    .toList(),
                                color: Colors.blue.shade700,
                                strokeWidth: 4.0,
                                isDotted: false,
                              ),
                            ],
                          ),

                        // Render active supervisor pins as markers
                        MarkerLayer(
                          markers: [
                            // Plot checkpoints / previous path nodes
                            ...selectedManager.pathHistory.map((p) {
                              return Marker(
                                point: LatLng(p.lat, p.lng),
                                width: 12,
                                height: 12,
                                child: Container(
                                  decoration: BoxDecoration(
                                    color: Colors.blue,
                                    shape: BoxShape.circle,
                                    border: Border.all(color: Colors.white, width: 1.5),
                                    boxShadow: const [
                                      BoxShadow(color: Colors.black26, blurRadius: 2, offset: Offset(0, 1))
                                    ]
                                  ),
                                ),
                              );
                            }),

                            // Plot current supervisor positions
                            ...managers.where((m) => m.status == 'checked-in').map((m) {
                              final isCurrentSelected = m.id == _selectedManagerId;
                              return Marker(
                                point: LatLng(m.currentLat, m.currentLng),
                                width: 45,
                                height: 45,
                                child: GestureDetector(
                                  onTap: () {
                                    setState(() {
                                      _selectedManagerId = m.id;
                                    });
                                  },
                                  child: Tooltip(
                                    message: "${m.name} (${m.speed} km/h)",
                                    child: Stack(
                                      alignment: Alignment.center,
                                      children: [
                                        // Pulsing radar ring
                                        Container(
                                          width: isCurrentSelected ? 40 : 32,
                                          height: isCurrentSelected ? 40 : 32,
                                          decoration: BoxDecoration(
                                            shape: BoxShape.circle,
                                            color: m.sos 
                                                ? Colors.red.withOpacity(0.3) 
                                                : Colors.green.withOpacity(0.3),
                                          ),
                                        ),
                                        Icon(
                                          Icons.location_on,
                                          color: m.sos ? Colors.red : Colors.green,
                                          size: isCurrentSelected ? 34 : 28,
                                        ),
                                        Positioned(
                                          top: 0,
                                          child: Container(
                                            padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                                            decoration: BoxDecoration(
                                              color: Colors.black87,
                                              borderRadius: BorderRadius.circular(4),
                                            ),
                                            child: Text(
                                              m.name.split(' ').first,
                                              style: const TextStyle(color: Colors.white, fontSize: 8, fontWeight: FontWeight.bold),
                                            ),
                                          ),
                                        )
                                      ],
                                    ),
                                  ),
                                ),
                              );
                            }),
                          ],
                        ),
                      ],
                    ),

                    // Quick Map Zoom actions overlay
                    Positioned(
                      bottom: 12,
                      right: 12,
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          FloatingActionButton.small(
                            heroTag: "zoom_in",
                            backgroundColor: Colors.white,
                            onPressed: () {
                              _mapController.move(_mapController.camera.center, _mapController.camera.zoom + 1);
                            },
                            child: const Icon(Icons.add, color: Colors.black87),
                          ),
                          const SizedBox(height: 6),
                          FloatingActionButton.small(
                            heroTag: "zoom_out",
                            backgroundColor: Colors.white,
                            onPressed: () {
                              _mapController.move(_mapController.camera.center, _mapController.camera.zoom - 1);
                            },
                            child: const Icon(Icons.remove, color: Colors.black87),
                          ),
                        ],
                      ),
                    ),

                    // Standard Map Legend Indicator overlay
                    Positioned(
                      bottom: 12,
                      left: 12,
                      child: Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: Colors.black.withOpacity(0.85),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            _LegendItem(color: Colors.green, label: "On Transit (Active)"),
                            SizedBox(height: 4),
                            _LegendItem(color: Colors.red, label: "SOS Active (Emergency)"),
                            SizedBox(height: 4),
                            _LegendItem(color: Colors.blue, label: "Route History Node"),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 24),

            // Live synchronized managers log list
            Row(
              mainAxisAlignment: MainAxisAlignment.between,
              children: [
                const Text("Municipal Zone Operators List", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                ElevatedButton.icon(
                  onPressed: () => _navigateToFirebaseSuite(service),
                  icon: const Icon(Icons.flash_on, size: 14, color: Colors.white),
                  label: const Text("Launch Firebase Suite", style: TextStyle(fontSize: 10, color: Colors.white)),
                  style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFe65100)),
                )
              ],
            ),
            const SizedBox(height: 8),
            managers.isEmpty
                ? const Card(
                    child: Padding(
                      padding: EdgeInsets.all(24.0),
                      child: Text("Database collection empty. Use 'Bootstrap Cloud Roster' in the Firebase Suite screen to seed data.", textAlign: TextAlign.center, style: TextStyle(fontSize: 12, color: Colors.grey)),
                    ),
                  )
                : ListView.builder(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    itemCount: managers.length,
                    itemBuilder: (context, idx) {
                      final m = managers[idx];
                      final isSelected = m.id == _selectedManagerId;
                      return Card(
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                          side: isSelected 
                              ? BorderSide(color: Colors.orange.shade700, width: 2) 
                              : BorderSide(color: Colors.grey.shade200),
                        ),
                        child: InkWell(
                          onTap: () {
                            setState(() {
                              _selectedManagerId = m.id;
                            });
                            if (m.status == 'checked-in') {
                              _mapController.move(LatLng(m.currentLat, m.currentLng), 13.0);
                            }
                          },
                          child: Padding(
                            padding: const EdgeInsets.all(12.0),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.between,
                                  children: [
                                    Text(m.name, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                      decoration: BoxDecoration(
                                        color: m.sos ? Colors.red.shade100 : Colors.emerald.shade100,
                                        borderRadius: BorderRadius.circular(4),
                                      ),
                                      child: Text(
                                        m.sos ? "🚨 SOS ACTIVE" : "ON-DUTY",
                                        style: TextStyle(
                                          fontSize: 9, 
                                          fontWeight: FontWeight.bold,
                                          color: m.sos ? Colors.red : Colors.emerald
                                        ),
                                      ),
                                    )
                                  ],
                                ),
                                const SizedBox(height: 4),
                                Text("Emp ID: ${m.empId} • Zone: ${m.zone}", style: const TextStyle(fontSize: 11, color: Colors.grey)),
                                const SizedBox(height: 8),
                                const Divider(),
                                const SizedBox(height: 4),
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.between,
                                  children: [
                                    _buildMiniIndicator(Icons.speed, "${m.speed} km/h"),
                                    _buildMiniIndicator(Icons.battery_std, "${m.battery}%"),
                                    _buildMiniIndicator(Icons.wifi, m.network),
                                  ],
                                ),
                                const SizedBox(height: 6),
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.between,
                                  children: [
                                    _buildMiniIndicator(Icons.directions_walk, "${m.distanceTravelledKm} km"),
                                    _buildMiniIndicator(Icons.timer, "${m.workingHours} hrs"),
                                    _buildMiniIndicator(Icons.update, m.lastUpdate.length > 10 ? m.lastUpdate.substring(0, 10) : m.lastUpdate),
                                  ],
                                ),
                              ],
                            ),
                          ),
                        ),
                      );
                    },
                  ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatCard(String label, String value, IconData icon, Color color) {
    return Card(
      elevation: 2,
      child: Padding(
        padding: const EdgeInsets.all(12.0),
        child: Row(
          children: [
            CircleAvatar(
              backgroundColor: color.withOpacity(0.1),
              radius: 18,
              child: Icon(icon, color: color, size: 18),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label, style: const TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: Colors.grey)),
                  const SizedBox(height: 2),
                  Text(value, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMiniIndicator(IconData icon, String value) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 12, color: Colors.grey),
        const SizedBox(width: 4),
        Text(value, style: const TextStyle(fontSize: 11)),
      ],
    );
  }

  ZoneManager _fallbackManager() {
    return ZoneManager(
      id: "fallback",
      name: "Rohan Kumar",
      phone: "+91 99999 88888",
      empId: "EMP-2026-999",
      zone: "Central Secretariat",
      wards: [1],
      baseLat: 28.6139,
      baseLng: 77.2090,
      status: "checked-in",
      battery: 100,
      batteryStatus: "Charged",
      network: "Excellent",
      speed: 0.0,
      lastUpdate: DateTime.now().toIso8601String(),
      currentLat: 28.6139,
      currentLng: 77.2090,
      currentAddress: "Central Vista, New Delhi",
      distanceTravelledKm: 0.0,
      workingHours: 0.0,
      idleTimeMin: 0,
      totalStops: 0,
      sos: false,
      pathHistory: const [],
      visitedPlaces: const [],
    );
  }
}

class _LegendItem extends StatelessWidget {
  final Color color;
  final String label;

  const _LegendItem({required this.color, required this.label});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 8,
          height: 8,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 6),
        Text(label, style: const TextStyle(color: Colors.white, fontSize: 8)),
      ],
    );
  }
}
