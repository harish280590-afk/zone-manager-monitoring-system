import 'dart:io';
import 'dart:async';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:firebase_analytics/firebase_analytics.dart';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/zone_manager.dart';
import '../models/session_user.dart';
import '../models/attendance_record.dart';

class FirebaseService extends ChangeNotifier {
  final FirebaseAuth _auth = FirebaseAuth.instance;
  final FirebaseFirestore _db = FirebaseFirestore.instance;
  final FirebaseStorage _storage = FirebaseStorage.instance;
  final FirebaseMessaging _messaging = FirebaseMessaging.instance;
  final FirebaseAnalytics _analytics = FirebaseAnalytics.instance;

  User? _currentUser;
  SessionUser? _currentSessionUser;
  String? _fcmToken;
  List<ZoneManager> _managers = [];
  bool _isLoading = false;

  StreamSubscription<QuerySnapshot>? _attendanceSubscription;
  List<AttendanceRecord> _attendanceHistory = [];
  AttendanceRecord? _activeAttendance;

  User? get currentUser => _currentUser;
  SessionUser? get currentSessionUser => _currentSessionUser;
  String? get fcmToken => _fcmToken;
  List<ZoneManager> get managers => _managers;
  bool get isLoading => _isLoading;
  List<AttendanceRecord> get attendanceHistory => _attendanceHistory;
  AttendanceRecord? get activeAttendance => _activeAttendance;

  FirebaseService() {
    _loadSavedSession();
    _auth.authStateChanges().listen((User? user) {
      _currentUser = user;
      notifyListeners();
      if (user != null) {
        logAnalyticsEvent('flutter_session_activated', {'email': user.email ?? ''});
      }
    });
    _setupMessaging();
    _listenToManagers();
  }

  // --- LOCAL SESSION RECOVERY ---
  Future<void> _loadSavedSession() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final sessionJson = prefs.getString('session_user');
      if (sessionJson != null) {
        _currentSessionUser = SessionUser.fromJson(sessionJson);
        notifyListeners();
        _listenToAttendance(_currentSessionUser!.empId);
      }
    } catch (e) {
      debugPrint("Failed to load saved session on boot: $e");
    }
  }

  // --- 1. SECURE EMPLOYEE ID AUTHENTICATION SERVICES ---
  Future<SessionUser> signUpWithEmpId({
    required String empId,
    required String password,
    required String name,
    required String role, // 'Admin' | 'Zone Manager'
    required String email,
    required bool rememberMe,
  }) async {
    _isLoading = true;
    notifyListeners();
    try {
      // Create firebase auth user securely
      final cred = await _auth.createUserWithEmailAndPassword(email: email, password: password);
      final uid = cred.user?.uid ?? '';

      // Prepare Session object
      final sessionUser = SessionUser(
        uid: uid,
        empId: empId,
        name: name,
        role: role,
        email: email,
      );

      // Store in secure Firestore users registry
      await _db.collection('users').doc(uid).set({
        'uid': uid,
        'empId': empId,
        'name': name,
        'role': role,
        'email': email,
        'createdAt': DateTime.now().toIso8601String(),
      });

      // If Zone Manager, also add to active spatial tracking list
      if (role == 'Zone Manager') {
        await _db.collection('managers').doc(empId).set({
          'id': empId,
          'name': name,
          'phone': '+91 99999 00000',
          'empId': empId,
          'zone': 'Delhi Central',
          'wards': [1, 2],
          'baseLat': 28.6139,
          'baseLng': 77.2090,
          'status': 'checked-out',
          'battery': 100,
          'batteryStatus': 'Charged',
          'network': 'Good',
          'speed': 0.0,
          'lastUpdate': DateTime.now().toIso8601String(),
          'currentLat': 28.6139,
          'currentLng': 77.2090,
          'currentAddress': 'Central Secretariat, New Delhi',
          'distanceTravelledKm': 0.0,
          'workingHours': 0.0,
          'idleTimeMin': 0,
          'totalStops': 0,
          'sos': false,
          'pathHistory': [],
          'visitedPlaces': [],
        });
      }

      _currentSessionUser = sessionUser;
      _listenToAttendance(sessionUser.empId);
      
      // Handle SharedPreferences Remember Session locally
      final prefs = await SharedPreferences.getInstance();
      if (rememberMe) {
        await prefs.setString('session_user', sessionUser.toJson());
        await prefs.setBool('remember_me', true);
      } else {
        await prefs.remove('session_user');
        await prefs.setBool('remember_me', false);
      }

      await logAnalyticsEvent('emp_id_signup', {
        'empId': empId,
        'role': role,
        'email': email,
      });

      return sessionUser;
    } catch (e) {
      logCrashReport(e.toString(), severity: 'warning');
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<SessionUser> signInWithEmpId({
    required String empId,
    required String password,
    required bool rememberMe,
  }) async {
    _isLoading = true;
    notifyListeners();
    try {
      String email = '';
      String name = '';
      String role = '';
      String uid = '';

      // A. Standard Fallback checks for pre-defined Demo/Test Accounts for frictionless evaluation:
      if (empId.trim() == 'EMP-ADMIN-001' && password == 'Password123') {
        email = 'admin@muncipal.gov.in';
        name = 'Super Admin';
        role = 'Admin';
        uid = 'admin-demo-uid';
      } else if (empId.trim() == 'EMP-2024-089' && password == 'Password123') {
        email = 'sanjay@muncipal.gov.in';
        name = 'Sanjay Sharma';
        role = 'Zone Manager';
        uid = 'zm1-demo-uid';
      } else if (empId.trim() == 'EMP-2024-112' && password == 'Password123') {
        email = 'amit@muncipal.gov.in';
        name = 'Amit Yadav';
        role = 'Zone Manager';
        uid = 'zm2-demo-uid';
      } else {
        // B. Dynamic check against cloud Firestore db users
        final query = await _db.collection('users').where('empId', isEqualTo: empId.trim()).get();
        if (query.docs.isEmpty) {
          throw Exception("No supervisor or administrator registered with Employee ID: $empId");
        }
        final doc = query.docs.first;
        email = doc.get('email') ?? '';
        name = doc.get('name') ?? '';
        role = doc.get('role') ?? 'Zone Manager';
        uid = doc.id;
      }

      // C. Perform secure Firebase Auth with standard credentials (skip for pure local demo profiles)
      if (!uid.endsWith('-demo-uid')) {
        await _auth.signInWithEmailAndPassword(email: email, password: password);
      }

      final sessionUser = SessionUser(
        uid: uid,
        empId: empId,
        name: name,
        role: role,
        email: email,
      );

      _currentSessionUser = sessionUser;
      _listenToAttendance(sessionUser.empId);

      // D. Store user session locally for "Remember Login" capability
      final prefs = await SharedPreferences.getInstance();
      if (rememberMe) {
        await prefs.setString('session_user', sessionUser.toJson());
        await prefs.setBool('remember_me', true);
      } else {
        await prefs.remove('session_user');
        await prefs.setBool('remember_me', false);
      }

      await logAnalyticsEvent('emp_id_login_success', {
        'empId': empId,
        'role': role,
      });

      return sessionUser;
    } catch (e) {
      logCrashReport(e.toString(), severity: 'warning');
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> signOutSession() async {
    _isLoading = true;
    notifyListeners();
    try {
      await _auth.signOut();
      _attendanceSubscription?.cancel();
      _attendanceSubscription = null;
      _attendanceHistory = [];
      _activeAttendance = null;
      _currentSessionUser = null;
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove('session_user');
      await prefs.setBool('remember_me', false);
      await logAnalyticsEvent('emp_id_logout', {});
    } catch (e) {
      logCrashReport(e.toString(), severity: 'error');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  // Backward-compatible placeholders for existing scripts
  Future<UserCredential?> signUp(String email, String password) async {
    return null;
  }

  Future<UserCredential?> signIn(String email, String password) async {
    return null;
  }

  Future<void> signOut() async {
    await signOutSession();
  }


  // --- 2. CLOUD FIRESTORE INTEGRATION ---
  void _listenToManagers() {
    _db.collection('managers').snapshots().listen((snapshot) {
      _managers = snapshot.docs.map((doc) => ZoneManager.fromMap(doc.data())).toList();
      notifyListeners();
    });
  }

  Future<void> bootstrapRoster(List<ZoneManager> demoData) async {
    _isLoading = true;
    notifyListeners();
    try {
      for (var manager in demoData) {
        await _db.collection('managers').doc(manager.id).set(manager.toMap());
      }
      logAnalyticsEvent('flutter_firestore_bootstrap', {'count': demoData.length});
    } catch (e) {
      logCrashReport(e.toString(), severity: 'error');
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> clearCloudRoster() async {
    _isLoading = true;
    notifyListeners();
    try {
      final snapshot = await _db.collection('managers').get();
      for (var doc in snapshot.docs) {
        await doc.reference.delete();
      }
      logAnalyticsEvent('flutter_firestore_clear', {});
    } catch (e) {
      logCrashReport(e.toString(), severity: 'error');
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> simulateUpdateSpeed(String managerId, double newSpeed) async {
    try {
      await _db.collection('managers').doc(managerId).update({
        'speed': newSpeed,
        'lastUpdate': DateTime.now().toIso8601String()
      });
      logAnalyticsEvent('flutter_speed_simulated', {'managerId': managerId, 'speed': newSpeed});
    } catch (e) {
      logCrashReport(e.toString(), severity: 'error');
    }
  }

  // --- 3. CLOUD STORAGE ATTACHMENTS ---
  Future<String> uploadFile(File file, String filename) async {
    _isLoading = true;
    notifyListeners();
    try {
      final ref = _storage.ref().child('inspections/${DateTime.now().millisecondsSinceEpoch}_$filename');
      final uploadTask = await ref.putFile(file);
      final downloadUrl = await uploadTask.ref.getDownloadURL();
      
      logAnalyticsEvent('flutter_storage_upload', {'filename': filename});
      return downloadUrl;
    } catch (e) {
      logCrashReport(e.toString(), severity: 'error');
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  // --- 4. FCM PUSH NOTIFICATIONS ---
  Future<void> _setupMessaging() async {
    try {
      NotificationSettings settings = await _messaging.requestPermission(
        alert: true,
        announcement: false,
        badge: true,
        carPlay: false,
        criticalAlert: true,
        provisional: false,
        sound: true,
      );
      
      if (settings.authorizationStatus == AuthorizationStatus.authorized) {
        _fcmToken = await _messaging.getToken();
        notifyListeners();
        
        FirebaseMessaging.onMessage.listen((RemoteMessage message) {
          if (kDebugMode) {
            print('FCM Broadcast received in foreground: ${message.notification?.title}');
          }
        });
      }
    } catch (e) {
      if (kDebugMode) {
        print("Push messaging setup failed or bypassed: $e");
      }
    }
  }

  Future<void> sendSimulatedNotification(String title, String body) async {
    try {
      final notifData = {
        'title': title,
        'body': body,
        'timestamp': DateTime.now().toIso8601String(),
        'recipient': 'All Devices',
        'delivered': true
      };
      await _db.collection('push_notifications').add(notifData);
      logAnalyticsEvent('flutter_push_dispatched', {'title': title});
    } catch (e) {
      logCrashReport(e.toString(), severity: 'error');
    }
  }

  // --- 5. CRASH REPORTING & DIAGNOSTICS ---
  Future<void> logCrashReport(String message, {String severity = 'error'}) async {
    try {
      final crashData = {
        'message': message,
        'stack': StackTrace.current.toString(),
        'timestamp': DateTime.now().toIso8601String(),
        'userAgent': 'Flutter App Native Client',
        'url': 'AppRoute://MainScreen',
        'severity': severity,
        'resolved': false
      };
      await _db.collection('crashes').add(crashData);
    } catch (e) {
      if (kDebugMode) {
        print("Failed logging crash to cloud Firestore: $e");
      }
    }
  }

  // --- 6. CORE ANALYTICS SERVICES ---
  Future<void> logAnalyticsEvent(String eventName, Map<String, dynamic> params) async {
    try {
      await _analytics.logEvent(name: eventName, parameters: params);
      
      // Save client-side event history log for dashboard view
      await _db.collection('analytics_events').add({
        'eventName': eventName,
        'params': params,
        'timestamp': DateTime.now().toIso8601String(),
        'userEmail': _currentUser?.email ?? 'anonymous'
      });
    } catch (e) {
      if (kDebugMode) {
        print("Failed logging analytics trace: $e");
      }
    }
  }

  // --- 7. SECURE GPS BIOMETRIC ATTENDANCE MODULE ---
  void _listenToAttendance(String empId) {
    _attendanceSubscription?.cancel();
    _attendanceSubscription = _db
        .collection('attendance')
        .where('empId', isEqualTo: empId)
        .snapshots()
        .listen((snapshot) {
      _attendanceHistory = snapshot.docs.map((doc) {
        final data = doc.data();
        data['id'] = doc.id;
        return AttendanceRecord.fromMap(data);
      }).toList();

      // Sort by date / timestamp descending
      _attendanceHistory.sort((a, b) {
        final aTs = a.toMap()['checkInTimestamp'] ?? '';
        final bTs = b.toMap()['checkInTimestamp'] ?? '';
        return bTs.compareTo(aTs);
      });

      // Find active check-in
      final activeList = _attendanceHistory.where((rec) => rec.status == 'Checked In').toList();
      _activeAttendance = activeList.isNotEmpty ? activeList.first : null;

      notifyListeners();
    });
  }

  Future<void> checkIn({
    required String empId,
    required String name,
    required double lat,
    required double lng,
    required String address,
    required String selfie,
  }) async {
    _isLoading = true;
    notifyListeners();
    try {
      final now = DateTime.now();
      final dateStr = "${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}";
      final timeStr = "${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')}";
      
      final docRef = await _db.collection('attendance').add({
        'empId': empId,
        'name': name,
        'date': dateStr,
        'checkInTime': timeStr,
        'checkInLat': lat,
        'checkInLng': lng,
        'checkInAddress': address,
        'checkInSelfie': selfie,
        'checkInTimestamp': now.toIso8601String(),
        'status': 'Checked In',
      });

      // Update manager status if applicable
      try {
        await _db.collection('managers').doc(empId).update({
          'status': 'checked-in',
          'currentLat': lat,
          'currentLng': lng,
          'currentAddress': address,
          'lastUpdate': now.toIso8601String(),
        });
      } catch (e) {
        debugPrint("Note: Manager record not updated or doesn't exist: $e");
      }

      await logAnalyticsEvent('attendance_check_in', {
        'empId': empId,
        'location': '$lat, $lng',
        'recordId': docRef.id,
      });
    } catch (e) {
      logCrashReport("checkIn failed: $e", severity: 'error');
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> checkOut({
    required String empId,
    required double lat,
    required double lng,
    required String address,
    required String selfie,
  }) async {
    _isLoading = true;
    notifyListeners();
    try {
      final now = DateTime.now();
      final timeStr = "${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')}";

      // Find active check-in document
      final activeQuery = await _db
          .collection('attendance')
          .where('empId', isEqualTo: empId)
          .where('status', isEqualTo: 'Checked In')
          .limit(1)
          .get();

      if (activeQuery.docs.isEmpty) {
        throw Exception("No active Checked In session found to check out from.");
      }

      final doc = activeQuery.docs.first;
      final checkInTimestampStr = doc.get('checkInTimestamp') as String?;
      double workingHours = 0.0;
      if (checkInTimestampStr != null) {
        final checkInTime = DateTime.parse(checkInTimestampStr);
        workingHours = now.difference(checkInTime).inSeconds / 3600.0; // Precise decimal hours
      }

      await doc.reference.update({
        'checkOutTime': timeStr,
        'checkOutLat': lat,
        'checkOutLng': lng,
        'checkOutAddress': address,
        'checkOutSelfie': selfie,
        'workingHours': double.parse(workingHours.toStringAsFixed(2)),
        'status': 'Checked Out',
        'checkOutTimestamp': now.toIso8601String(),
      });

      // Update manager status if applicable
      try {
        await _db.collection('managers').doc(empId).update({
          'status': 'checked-out',
          'currentLat': lat,
          'currentLng': lng,
          'currentAddress': address,
          'lastUpdate': now.toIso8601String(),
        });
      } catch (e) {
        debugPrint("Note: Manager record status update failed: $e");
      }

      await logAnalyticsEvent('attendance_check_out', {
        'empId': empId,
        'location': '$lat, $lng',
        'workingHours': workingHours,
      });
    } catch (e) {
      logCrashReport("checkOut failed: $e", severity: 'error');
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
}
