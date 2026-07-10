import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'dart:io';
import '../services/firebase_service.dart';
import '../models/zone_manager.dart';

class FirebaseControlScreen extends StatefulWidget {
  const FirebaseControlScreen({super.key});

  @override
  State<FirebaseControlScreen> createState() => _FirebaseControlScreenState();
}

class _FirebaseControlScreenState extends State<FirebaseControlScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final _notifTitleController = TextEditingController(text: "🚨 EMERGENCY FIELD DISPATCH");
  final _notifBodyController = TextEditingController(text: "New critical municipal desilting task assigned in Ward 13.");

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 6, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    _notifTitleController.dispose();
    _notifBodyController.dispose();
    super.dispose();
  }

  // Demo zone managers list to bootstrap Firestore database
  final List<ZoneManager> _demoZoneManagers = [
    ZoneManager(
      id: "zm-1",
      name: "Sanjay Sharma",
      phone: "+91 98123 45678",
      empId: "EMP-2024-089",
      zone: "Civil Lines (North Delhi)",
      wards: [9, 13, 14],
      baseLat: 28.6812,
      baseLng: 77.2225,
      status: "checked-in",
      battery: 88,
      batteryStatus: "Unplugged",
      network: "LTE / Excellent",
      speed: 34.0,
      lastUpdate: DateTime.now().toIso8601String(),
      currentLat: 28.6845,
      currentLng: 77.2290,
      currentAddress: "Model Town Phase II, GTB Nagar Metro, New Delhi",
      distanceTravelledKm: 14.8,
      workingHours: 6.5,
      idleTimeMin: 22,
      totalStops: 5,
      sos: false,
      pathHistory: const [],
      visitedPlaces: const [],
    ),
    ZoneManager(
      id: "zm-2",
      name: "Amit Yadav",
      phone: "+91 98765 43210",
      empId: "EMP-2024-112",
      zone: "Karol Bagh (Central Delhi)",
      wards: [24, 25, 27],
      baseLat: 28.6443,
      baseLng: 77.1901,
      status: "checked-in",
      battery: 42,
      batteryStatus: "Discharging",
      network: "5G / Good",
      speed: 12.0,
      lastUpdate: DateTime.now().toIso8601String(),
      currentLat: 28.6490,
      currentLng: 77.1950,
      currentAddress: "Rajendra Place Metro station, Pusa Road, New Delhi",
      distanceTravelledKm: 8.4,
      workingHours: 4.2,
      idleTimeMin: 45,
      totalStops: 3,
      sos: true, // SOS Active
      pathHistory: const [],
      visitedPlaces: const [],
    ),
  ];

  @override
  Widget build(BuildContext context) {
    final service = Provider.of<FirebaseService>(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text("Firebase Suite Control Center"),
        backgroundColor: const Color(0xFFe65100),
        bottom: TabBar(
          controller: _tabController,
          isScrollable: true,
          indicatorColor: Colors.white,
          tabs: const [
            Tab(icon: Icon(Icons.verified_user), text: "Auth"),
            Tab(icon: Icon(Icons.storage), text: "Firestore"),
            Tab(icon: Icon(Icons.cloud_upload), text: "Storage"),
            Tab(icon: Icon(Icons.notifications_active), text: "FCM Push"),
            Tab(icon: Icon(Icons.bug_report), text: "Crashlytics"),
            Tab(icon: Icon(Icons.insights), text: "Analytics"),
          ],
        ),
      ),
      body: service.isLoading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFFe65100)))
          : TabBarView(
              controller: _tabController,
              children: [
                _buildAuthTab(service),
                _buildFirestoreTab(service),
                _buildStorageTab(service),
                _buildPushTab(service),
                _buildCrashlyticsTab(service),
                _buildAnalyticsTab(),
              ],
            ),
    );
  }

  // --- TAB 1: AUTHENTICATION ---
  Widget _buildAuthTab(FirebaseService service) {
    final user = service.currentUser;
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Card(
            color: Colors.orange.shade50,
            child: const Padding(
              padding: EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text("Secure Authentication State", style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFFe65100))),
                  SizedBox(height: 8),
                  Text("Manages real-time OIDC user accounts inside the Firebase secure backend. Persistent logins are kept local to SQLite/IndexedDB.", style: TextStyle(fontSize: 12)),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          if (user != null) ...[
            ListTile(
              title: const Text("Current Logged In Email"),
              subtitle: Text(user.email ?? "Anonymous"),
              leading: const Icon(Icons.check_circle, color: Colors.emerald),
            ),
            ListTile(
              title: const Text("User UID"),
              subtitle: Text(user.uid, style: const TextStyle(fontSize: 11, fontFamily: 'monospace')),
              leading: const Icon(Icons.fingerprint),
            ),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              onPressed: () async {
                await service.signOut();
                if (mounted) Navigator.pop(context);
              },
              icon: const Icon(Icons.logout),
              label: const Text("Terminate Supervisor Session"),
              style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            ),
          ] else ...[
            const Center(
              child: Padding(
                padding: EdgeInsets.all(32.0),
                child: Text("No active credentials loaded. Sign in on main portal."),
              ),
            )
          ]
        ],
      ),
    );
  }

  // --- TAB 2: CLOUD FIRESTORE ---
  Widget _buildFirestoreTab(FirebaseService service) {
    return Padding(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: () async {
                    await service.bootstrapRoster(_demoZoneManagers);
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text("Firestore roster bootstrapped successfully!")),
                    );
                  },
                  icon: const Icon(Icons.cloud_upload),
                  label: const Text("Bootstrap Cloud Roster"),
                  style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFe65100)),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: () async {
                    await service.clearCloudRoster();
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text("Firestore database collection deleted.")),
                    );
                  },
                  icon: const Icon(Icons.delete_sweep),
                  label: const Text("Clear Firestore"),
                  style: ElevatedButton.styleFrom(backgroundColor: Colors.redAccent),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          const Text(
            "Live Cloud Firestore Collection: 'managers'",
            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
          ),
          const SizedBox(height: 8),
          Expanded(
            child: service.managers.isEmpty
                ? const Center(child: Text("No active field agents in Firestore. Click 'Bootstrap'."))
                : ListView.builder(
                    itemCount: service.managers.length,
                    itemBuilder: (context, idx) {
                      final manager = service.managers[idx];
                      return Card(
                        child: ListTile(
                          title: Text(manager.name, style: const TextStyle(fontWeight: FontWeight.bold)),
                          subtitle: Text("Zone: ${manager.zone}\nAddress: ${manager.currentAddress}", style: const TextStyle(fontSize: 11)),
                          trailing: IconButton(
                            icon: const Icon(Icons.gps_fixed, color: Colors.blue),
                            onPressed: () {
                              service.simulateUpdateSpeed(manager.id, 45.0);
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(content: Text("Simulating speed change for ${manager.name}")),
                              );
                            },
                          ),
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }

  // --- TAB 3: CLOUD STORAGE ---
  Widget _buildStorageTab(FirebaseService service) {
    return Padding(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.cloud_done, size: 72, color: Colors.orange),
          const SizedBox(height: 16),
          const Text(
            "Cloud Storage Bucket Manager",
            textAlign: TextAlign.center,
            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
          ),
          const SizedBox(height: 8),
          const Text(
            "Supports high-resolution field photos, signature receipts, and PDF reports. Secures media dynamically with direct Google API proxy keys.",
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 12, color: Colors.grey),
          ),
          const SizedBox(height: 32),
          ElevatedButton.icon(
            onPressed: () {
              // Simulated pick and upload file
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text("Simulation: Media attached and uploaded successfully to Cloud Storage bucket!")),
              );
              service.logAnalyticsEvent('flutter_media_uploaded_sim', {'type': 'camera_receipt'});
            },
            icon: const Icon(Icons.add_photo_alternate),
            label: const Text("Simulate Upload Inspection Photo"),
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFe65100), padding: const EdgeInsets.symmetric(vertical: 14)),
          )
        ],
      ),
    );
  }

  // --- TAB 4: FCM PUSH NOTIFICATIONS ---
  Widget _buildPushTab(FirebaseService service) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text("Broadcast Cloud Directives", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
          const SizedBox(height: 16),
          TextField(
            controller: _notifTitleController,
            decoration: const InputDecoration(labelText: "Push Title", border: OutlineInputBorder()),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _notifBodyController,
            maxLines: 2,
            decoration: const InputDecoration(labelText: "Notification Body Message", border: OutlineInputBorder()),
          ),
          const SizedBox(height: 24),
          ElevatedButton.icon(
            onPressed: () async {
              await service.sendSimulatedNotification(_notifTitleController.text, _notifBodyController.text);
              if (mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text("Simulated FCM Push Notification broadcasted to field Force!")),
                );
              }
            },
            icon: const Icon(Icons.send_and_archive),
            label: const Text("Dispatch FCM Broadcast"),
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFe65100), padding: const EdgeInsets.symmetric(vertical: 14)),
          ),
        ],
      ),
    );
  }

  // --- TAB 5: CRASH REPORTING ---
  Widget _buildCrashlyticsTab(FirebaseService service) {
    return Padding(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.bug_report, size: 72, color: Colors.red),
          const SizedBox(height: 16),
          const Text("Simulated Crashlytics Engine", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
          const SizedBox(height: 8),
          const Text("Tap below to throw a simulated Dart micro-runtime exception. The stack-trace is captured and streamed to Cloud Firestore diagnostics.", textAlign: TextAlign.center, style: TextStyle(fontSize: 12, color: Colors.grey)),
          const SizedBox(height: 32),
          ElevatedButton(
            onPressed: () {
              service.logCrashReport("FormatException: Invalid coordinates string layout on background service");
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text("Dart runtime exception generated and captured by Firebase Crashlytics!")),
              );
            },
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            child: const Text("Trigger Runtime Exception"),
          )
        ],
      ),
    );
  }

  // --- TAB 6: ANALYTICS ---
  Widget _buildAnalyticsTab() {
    return const Padding(
      padding: EdgeInsets.all(16.0),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.query_stats, size: 72, color: Colors.blue),
          SizedBox(height: 16),
          Text("Firebase Analytics Engine", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
          SizedBox(height: 8),
          Text("Tracks supervisor interactions, tab events, speeds, storage files, and logins.", textAlign: TextAlign.center, style: TextStyle(fontSize: 12, color: Colors.grey)),
        ],
      ),
    );
  }
}
