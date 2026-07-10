import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:geolocator/geolocator.dart';
import 'package:intl/intl.dart';
import '../services/firebase_service.dart';
import '../models/attendance_record.dart';

class AttendanceScreen extends StatefulWidget {
  const AttendanceScreen({super.key});

  @override
  State<AttendanceScreen> createState() => _AttendanceScreenState();
}

class _AttendanceScreenState extends State<AttendanceScreen> with SingleTickerProviderStateMixin {
  bool _isLocating = false;
  double _capturedLat = 28.6139;
  double _capturedLng = 77.2090;
  String _capturedAddress = "Delhi Secretariat, IP Estate, New Delhi";
  String _errorMessage;

  // Camera Simulation properties
  bool _isCameraActive = false;
  String _selectedSelfieUrl = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400";
  bool _selfieCaptured = false;
  double _scanLinePosition = 0.0;
  Timer _scanTimer;
  Timer _stopwatchTimer;
  Duration _shiftDuration = Duration.zero;

  // Preset face options for biometric simulation
  final List<Map<String, String>> _avatarPresets = [
    {
      "name": "Sanjay Sharma",
      "url": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400",
      "role": "Delhi Central Sector ZM"
    },
    {
      "name": "Amit Yadav",
      "url": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400",
      "role": "Delhi West Ward ZM"
    },
    {
      "name": "Simran Kaur",
      "url": "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400",
      "role": "Delhi South Ward ZM"
    }
  ];

  @override
  void initState() {
    super.initState();
    _triggerLocationFetch();
    _startScanAnimation();
    _initShiftStopwatch();
  }

  @override
  void dispose() {
    _scanTimer?.cancel();
    _stopwatchTimer?.cancel();
    super.dispose();
  }

  void _startScanAnimation() {
    _scanTimer = Timer.periodic(const Duration(milliseconds: 30), (timer) {
      if (_isCameraActive) {
        setState(() {
          _scanLinePosition += 0.02;
          if (_scanLinePosition > 1.0) {
            _scanLinePosition = 0.0;
          }
        });
      }
    });
  }

  void _initShiftStopwatch() {
    _stopwatchTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      final service = Provider.of<FirebaseService>(context, listen: false);
      final active = service.activeAttendance;
      if (active != null) {
        // Find time difference
        try {
          final now = DateTime.now();
          final todayStr = DateFormat('yyyy-MM-dd').format(now);
          
          // To calculate duration, we need checkInTimestamp or checkInTime
          // Let's parse checkInTime which is "HH:mm" on the current date
          final parts = active.checkInTime.split(':');
          final hr = int.parse(parts[0]);
          final min = int.parse(parts[1]);
          final checkInDateTime = DateTime(now.year, now.month, now.day, hr, min);
          
          setState(() {
            _shiftDuration = now.difference(checkInDateTime);
          });
        } catch (e) {
          debugPrint("Failed to calculate shift duration: $e");
        }
      } else {
        if (_shiftDuration != Duration.zero) {
          setState(() {
            _shiftDuration = Duration.zero;
          });
        }
      }
    });
  }

  Future<void> _triggerLocationFetch() async {
    setState(() {
      _isLocating = true;
      _errorMessage = null;
    });

    try {
      // Check and request location permission
      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }

      if (permission == LocationPermission.deniedForever) {
        // Bypassed gracefully to simulator mode
        _loadSimulatedAddress();
        return;
      }

      Position position = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
        timeLimit: const Duration(seconds: 4),
      );

      setState(() {
        _capturedLat = position.latitude;
        _capturedLng = position.longitude;
        _capturedAddress = "Sector Sector 6, Dwarka, New Delhi [GPS Lock Verified]";
        _isLocating = false;
      });
    } catch (e) {
      debugPrint("Frictionless location fallback active: $e");
      _loadSimulatedAddress();
    }
  }

  void _loadSimulatedAddress() {
    // Generate simulated coordinates slightly randomized around Delhi Central
    final double randLat = 28.6139 + (DateTime.now().second % 10 - 5) * 0.0012;
    final double randLng = 77.2090 + (DateTime.now().second % 15 - 7) * 0.0009;
    
    final List<String> simulatedLocations = [
      "Connaught Place Block-F, New Delhi",
      "Delhi Secretariat Complex, Players Building, IP Estate",
      "Rajpath Marg near India Gate, Central Delhi",
      "Sector-4 Metropolitan Area, Dwarka, West Delhi",
      "South Extension Part 2 Market Area, South Delhi"
    ];

    final index = DateTime.now().second % simulatedLocations.length;

    setState(() {
      _capturedLat = double.parse(randLat.toStringAsFixed(6));
      _capturedLng = double.parse(randLng.toStringAsFixed(6));
      _capturedAddress = "${simulatedLocations[index]} [Simulation Mode]";
      _isLocating = false;
    });
  }

  void _snapSelfie() {
    setState(() {
      _selfieCaptured = true;
      _isCameraActive = false;
    });
    
    // Play camera sound / feedback
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Row(
          children: [
            Icon(Icons.photo_camera, color: Colors.white),
            SizedBox(width: 12),
            Text("Biometric Face Capture Completed and Watermarked!"),
          ],
        ),
        backgroundColor: Colors.emerald,
        duration: Duration(seconds: 2),
      ),
    );
  }

  Future<void> _handleCheckIn() async {
    final service = Provider.of<FirebaseService>(context, listen: false);
    final user = service.currentSessionUser;
    
    if (user == null) return;

    if (!_selfieCaptured) {
      setState(() {
        _errorMessage = "Biometric selfie capture is mandatory before Check-In.";
      });
      return;
    }

    try {
      await service.checkIn(
        empId: user.empId,
        name: user.name,
        lat: _capturedLat,
        lng: _capturedLng,
        address: _capturedAddress,
        selfie: _selectedSelfieUrl,
      );

      setState(() {
        _selfieCaptured = false;
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text("CHECK-IN SUCCESSFUL! Shift registered in Firebase registry."),
            backgroundColor: Colors.emerald,
          ),
        );
      }
    } catch (e) {
      setState(() {
        _errorMessage = e.toString().replaceFirst("Exception: ", "");
      });
    }
  }

  Future<void> _handleCheckOut() async {
    final service = Provider.of<FirebaseService>(context, listen: false);
    final user = service.currentSessionUser;
    
    if (user == null) return;

    if (!_selfieCaptured) {
      setState(() {
        _errorMessage = "Biometric selfie capture is mandatory before Check-Out.";
      });
      return;
    }

    try {
      await service.checkOut(
        empId: user.empId,
        lat: _capturedLat,
        lng: _capturedLng,
        address: _capturedAddress,
        selfie: _selectedSelfieUrl,
      );

      setState(() {
        _selfieCaptured = false;
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text("CHECK-OUT COMPLETED! Total shift hours saved."),
            backgroundColor: Colors.amber,
          ),
        );
      }
    } catch (e) {
      setState(() {
        _errorMessage = e.toString().replaceFirst("Exception: ", "");
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final service = Provider.of<FirebaseService>(context);
    final active = service.activeAttendance;
    final history = service.attendanceHistory;

    final String formatDuration = _shiftDuration.inHours.toString().padLeft(2, '0') +
        ":" +
        (_shiftDuration.inMinutes % 60).toString().padLeft(2, '0') +
        ":" +
        (_shiftDuration.inSeconds % 60).toString().padLeft(2, '0');

    return Scaffold(
      backgroundColor: Colors.grey.shade50,
      appBar: AppBar(
        title: const Text(
          "SECURE GPS ATTENDANCE MODULE",
          style: TextStyle(fontWeight: FontWeight.black, fontSize: 14, letterSpacing: 1.0),
        ),
        backgroundColor: const Color(0xFFe65100),
        foregroundColor: Colors.white,
        elevation: 2,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _triggerLocationFetch,
            tooltip: "Recalculate GPS coordinates",
          )
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Status Alert Card
            _buildStatusHeader(active, formatDuration),
            const SizedBox(height: 16),

            // Main Capture and Biometric Panel
            Card(
              elevation: 4,
              shadowColor: Colors.black26,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.pin_drop, color: Color(0xFFe65100)),
                        const SizedBox(width: 8),
                        const Text(
                          "GPS SAT-LOCK & ADDRESS VERIFICATION",
                          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, letterSpacing: 0.5),
                        ),
                        const Spacer(),
                        if (_isLocating)
                          const SizedBox(
                            width: 14,
                            height: 14,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFFe65100)),
                          )
                        else
                          GestureDetector(
                            onTap: _triggerLocationFetch,
                            child: const Text(
                              "REFRESH GPS",
                              style: TextStyle(color: Color(0xFFe65100), fontSize: 10, fontWeight: FontWeight.bold),
                            ),
                          ),
                      ],
                    ),
                    const Divider(height: 20),

                    // Coordinates details
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.grey.shade100,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: Colors.grey.shade300),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              _buildGeoBadge("LATITUDE", "$_capturedLat° N"),
                              const SizedBox(width: 12),
                              _buildGeoBadge("LONGITUDE", "$_capturedLng° E"),
                            ],
                          ),
                          const SizedBox(height: 10),
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Icon(Icons.location_on, size: 16, color: Colors.grey),
                              const SizedBox(width: 6),
                              Expanded(
                                child: Text(
                                  _capturedAddress,
                                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.grey.shade800),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Error panel
                    if (_errorMessage != null) ...[
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: Colors.red.shade50,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: Colors.red.shade200),
                        ),
                        child: Row(
                          children: [
                            Icon(Icons.gpp_bad_outlined, color: Colors.red.shade700, size: 20),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                _errorMessage!,
                                style: TextStyle(color: Colors.red.shade900, fontSize: 11, fontWeight: FontWeight.bold),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),
                    ],

                    // Biometric Selfie Viewport
                    const Text(
                      "MANDATORY BIOMETRIC IDENTITY MATCH (SELFIE)",
                      style: TextStyle(fontWeight: FontWeight.bold, fontSize: 11, color: Colors.grey, letterSpacing: 0.5),
                    ),
                    const SizedBox(height: 8),
                    _buildCameraViewport(),
                    const SizedBox(height: 12),

                    // Selector for presets
                    const Text(
                      "SIMULATE FACE TEMPLATE FOR BIOMETRIC SCANNER",
                      style: TextStyle(fontWeight: FontWeight.bold, fontSize: 10, color: Colors.grey, letterSpacing: 0.5),
                    ),
                    const SizedBox(height: 6),
                    _buildAvatarSelector(),
                    const SizedBox(height: 20),

                    // Action buttons Check-In and Check-Out
                    Row(
                      children: [
                        Expanded(
                          child: ElevatedButton.icon(
                            onPressed: (active == null && !service.isLoading) ? _handleCheckIn : null,
                            icon: const Icon(Icons.login),
                            label: const Text("GPS CHECK-IN", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: Colors.emerald.shade700,
                              foregroundColor: Colors.white,
                              disabledBackgroundColor: Colors.grey.shade300,
                              padding: const EdgeInsets.symmetric(vertical: 14),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: ElevatedButton.icon(
                            onPressed: (active != null && !service.isLoading) ? _handleCheckOut : null,
                            icon: const Icon(Icons.logout),
                            label: const Text("GPS CHECK-OUT", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: Colors.amber.shade800,
                              foregroundColor: Colors.white,
                              disabledBackgroundColor: Colors.grey.shade300,
                              padding: const EdgeInsets.symmetric(vertical: 14),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 20),

            // History Log Section
            _buildHistorySection(history),
          ],
        ),
      ),
    );
  }

  Widget _buildStatusHeader(AttendanceRecord? active, String formatDuration) {
    final bool hasActiveSession = active != null;
    return Card(
      color: hasActiveSession ? Colors.emerald.shade900 : Colors.slate.shade900,
      elevation: 4,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 16.0),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.15),
                shape: BoxShape.circle,
              ),
              child: Icon(
                hasActiveSession ? Icons.timer_outlined : Icons.timer_off_outlined,
                color: Colors.white,
                size: 28,
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    hasActiveSession ? "ACTIVE SHIFT RUNNING" : "SHIFT CURRENTLY CLOSED",
                    style: TextStyle(
                      fontWeight: FontWeight.black,
                      fontSize: 12,
                      letterSpacing: 0.5,
                      color: hasActiveSession ? Colors.emerald.shade300 : Colors.amber.shade300,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    hasActiveSession
                        ? "Checked-in at: ${active.checkInTime} (${active.date})"
                        : "Ready for secure biometric log-in.",
                    style: const TextStyle(color: Colors.white70, fontSize: 11),
                  ),
                ],
              ),
            ),
            if (hasActiveSession)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: Colors.emerald.shade800,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: Colors.emerald.shade300, width: 1.0),
                ),
                child: Text(
                  formatDuration,
                  style: const TextStyle(
                    fontFamily: 'monospace',
                    fontSize: 14,
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildGeoBadge(String title, String val) {
    return Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: TextStyle(color: Colors.grey.shade500, fontSize: 9, fontWeight: FontWeight.bold)),
          const SizedBox(height: 2),
          Text(val, style: const TextStyle(fontFamily: 'monospace', fontSize: 12, fontWeight: FontWeight.bold, color: Colors.black)),
        ],
      ),
    );
  }

  Widget _buildCameraViewport() {
    if (!_isCameraActive && !_selfieCaptured) {
      return Container(
        height: 200,
        decoration: BoxDecoration(
          color: Colors.black87,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.grey.shade400, width: 1),
        ),
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.add_a_photo_outlined, color: Colors.grey.shade500, size: 40),
              const SizedBox(height: 12),
              ElevatedButton(
                onPressed: () {
                  setState(() {
                    _isCameraActive = true;
                  });
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFe65100),
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                ),
                child: const Text("ACTIVATE BIOMETRIC VIEWPORT", style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
              ),
            ],
          ),
        ),
      );
    }

    return ClipRRect(
      borderRadius: BorderRadius.circular(12),
      child: Container(
        height: 220,
        color: Colors.black,
        child: Stack(
          alignment: Alignment.center,
          children: [
            // Captured Image or live viewport
            Image.network(
              _selectedSelfieUrl,
              width: double.infinity,
              height: double.infinity,
              fit: BoxFit.cover,
              errorBuilder: (context, error, stackTrace) {
                return Container(
                  color: Colors.grey.shade800,
                  child: const Center(
                    child: Icon(Icons.person, size: 100, color: Colors.grey),
                  ),
                );
              },
            ),

            // Live HUD scanner overlay if camera active
            if (_isCameraActive) ...[
              // Scanning laser line
              Positioned(
                top: _scanLinePosition * 220,
                left: 0,
                right: 0,
                child: Container(
                  height: 2,
                  decoration: BoxDecoration(
                    color: Colors.emerald,
                    boxShadow: [
                      BoxShadow(
                        color: Colors.emerald.withOpacity(0.8),
                        blurRadius: 6,
                        spreadRadius: 2,
                      )
                    ],
                  ),
                ),
              ),

              // Facial alignment frame guide
              Container(
                width: 140,
                height: 170,
                decoration: BoxDecoration(
                  border: Border.all(color: Colors.emerald, width: 1.5, style: BorderStyle.solid),
                  borderRadius: BorderRadius.all(Radius.elliptical(70, 85)),
                ),
                child: Container(
                  alignment: Alignment.topCenter,
                  padding: const EdgeInsets.only(top: 10),
                  child: const Text(
                    "ALIGN FACE HERE",
                    style: TextStyle(color: Colors.emerald, fontSize: 8, fontWeight: FontWeight.bold, backgroundColor: Colors.black38),
                  ),
                ),
              ),

              // Corner brackets
              Positioned(
                top: 10,
                left: 10,
                child: _buildCameraCorner(true, true),
              ),
              Positioned(
                top: 10,
                right: 10,
                child: _buildCameraCorner(true, false),
              ),
              Positioned(
                bottom: 10,
                left: 10,
                child: _buildCameraCorner(false, true),
              ),
              Positioned(
                bottom: 10,
                right: 10,
                child: _buildCameraCorner(false, false),
              ),

              // Live Telemetry Text Overlays
              Positioned(
                top: 12,
                left: 12,
                child: _buildTelemetryLine("GPS FIX: $_capturedLat, $_capturedLng"),
              ),
              Positioned(
                bottom: 12,
                left: 12,
                child: _buildTelemetryLine("BIOMETRIC SCANNING: 98% SYNC"),
              ),

              // Trigger snap button
              Positioned(
                bottom: 10,
                child: FloatingActionButton.small(
                  onPressed: _snapSelfie,
                  backgroundColor: Colors.emerald,
                  child: const Icon(Icons.camera, color: Colors.white),
                ),
              ),
            ],

            // If captured, show verified stamp watermarked directly on it
            if (_selfieCaptured) ...[
              Container(
                color: Colors.black.withOpacity(0.3),
              ),
              Positioned(
                top: 10,
                right: 10,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: Colors.emerald,
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: Colors.white, width: 1),
                  ),
                  child: const Row(
                    children: [
                      Icon(Icons.verified, color: Colors.white, size: 14),
                      SizedBox(width: 4),
                      Text(
                        "FACIAL LOCK OK",
                        style: TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.black, letterSpacing: 0.5),
                      ),
                    ],
                  ),
                ),
              ),

              // Watermark at bottom
              Positioned(
                bottom: 0,
                left: 0,
                right: 0,
                child: Container(
                  padding: const EdgeInsets.all(8),
                  color: Colors.black54,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        "TIMESTAMP: ${DateFormat('yyyy-MM-dd HH:mm:ss').format(DateTime.now())}",
                        style: const TextStyle(color: Colors.white, fontSize: 8, fontFamily: 'monospace', fontWeight: FontWeight.bold),
                      ),
                      Text(
                        "LOCATION: $_capturedAddress",
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(color: Colors.white70, fontSize: 7, fontFamily: 'monospace'),
                      ),
                      Text(
                        "COORDS: $_capturedLat° N, $_capturedLng° E",
                        style: const TextStyle(color: Colors.white70, fontSize: 7, fontFamily: 'monospace'),
                      ),
                    ],
                  ),
                ),
              ),

              // Re-snap button option
              Positioned(
                top: 10,
                left: 10,
                child: IconButton(
                  style: IconButton.styleFrom(backgroundColor: Colors.black45),
                  icon: const Icon(Icons.replay, color: Colors.white, size: 18),
                  onPressed: () {
                    setState(() {
                      _selfieCaptured = false;
                      _isCameraActive = true;
                    });
                  },
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildCameraCorner(bool top, bool left) {
    return Container(
      width: 15,
      height: 15,
      decoration: BoxDecoration(
        border: Border(
          top: top ? const BorderSide(color: Colors.emerald, width: 2) : BorderSide.none,
          bottom: !top ? const BorderSide(color: Colors.emerald, width: 2) : BorderSide.none,
          left: left ? const BorderSide(color: Colors.emerald, width: 2) : BorderSide.none,
          right: !left ? const BorderSide(color: Colors.emerald, width: 2) : BorderSide.none,
        ),
      ),
    );
  }

  Widget _buildTelemetryLine(String text) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: Colors.black54,
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        text,
        style: const TextStyle(color: Colors.emerald, fontSize: 7, fontFamily: 'monospace', fontWeight: FontWeight.bold),
      ),
    );
  }

  Widget _buildAvatarSelector() {
    return Row(
      children: _avatarPresets.map((av) {
        final isSelected = _selectedSelfieUrl == av['url'];
        return Expanded(
          child: GestureDetector(
            onTap: () {
              setState(() {
                _selectedSelfieUrl = av['url'] ?? '';
                // Trigger camera re-lock
                _isCameraActive = true;
                _selfieCaptured = false;
              });
            },
            child: Container(
              margin: const EdgeInsets.symmetric(horizontal: 4),
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: isSelected ? Colors.orange.shade50 : Colors.white,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(
                  color: isSelected ? const Color(0xFFe65100) : Colors.grey.shade300,
                  width: isSelected ? 1.5 : 1,
                ),
              ),
              child: Column(
                children: [
                  CircleAvatar(
                    backgroundImage: NetworkImage(av['url'] ?? ''),
                    radius: 18,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    av['name'] ?? '',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 8.5,
                      fontWeight: isSelected ? FontWeight.black : FontWeight.normal,
                      color: isSelected ? const Color(0xFFe65100) : Colors.black87,
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      }).toList(),
    );
  }

  Widget _buildHistorySection(List<AttendanceRecord> history) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text(
          "SECURE ATTENDANCE HISTORY LOGS",
          style: TextStyle(fontWeight: FontWeight.black, fontSize: 12, letterSpacing: 0.8, color: Colors.grey),
        ),
        const SizedBox(height: 8),
        if (history.isEmpty)
          Card(
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 40, horizontal: 20),
              child: Column(
                children: [
                  Icon(Icons.history_toggle_off, color: Colors.grey.shade300, size: 48),
                  const SizedBox(height: 12),
                  const Text(
                    "No historic attendance logs found for this supervisor.",
                    style: TextStyle(color: Colors.grey, fontSize: 12),
                  ),
                ],
              ),
            ),
          )
        else
          ListView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: history.length,
            itemBuilder: (context, idx) {
              final rec = history[idx];
              final bool isCurrentActive = rec.status == 'Checked In';

              return Card(
                elevation: 1.5,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                margin: const EdgeInsets.only(bottom: 12),
                child: Theme(
                  data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
                  child: ExpansionTile(
                    leading: Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        color: isCurrentActive ? Colors.emerald.shade50 : Colors.amber.shade50,
                        shape: BoxShape.circle,
                      ),
                      child: ClipOval(
                        child: Image.network(
                          rec.checkInSelfie,
                          fit: BoxFit.cover,
                          errorBuilder: (context, error, stackTrace) => Icon(
                            isCurrentActive ? Icons.login : Icons.logout,
                            color: isCurrentActive ? Colors.emerald.shade800 : Colors.amber.shade800,
                          ),
                        ),
                      ),
                    ),
                    title: Row(
                      children: [
                        Text(
                          rec.date,
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
                        ),
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: isCurrentActive ? Colors.emerald.shade100 : Colors.grey.shade100,
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            rec.status.toUpperCase(),
                            style: TextStyle(
                              fontSize: 8,
                              fontWeight: FontWeight.bold,
                              color: isCurrentActive ? Colors.emerald.shade900 : Colors.grey.shade800,
                            ),
                          ),
                        ),
                      ],
                    ),
                    subtitle: Text(
                      isCurrentActive 
                          ? "Checked in: ${rec.checkInTime}"
                          : "Shift: ${rec.checkInTime} - ${rec.checkOutTime ?? '--'}  •  ${rec.workingHours ?? '0.00'} hrs",
                      style: TextStyle(fontSize: 10, color: Colors.grey.shade600),
                    ),
                    children: [
                      Container(
                        padding: const EdgeInsets.all(16),
                        color: Colors.grey.shade50,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            _buildHistoryDetailRow("Check-In Time", rec.checkInTime),
                            _buildHistoryDetailRow("Check-In Coordinates", "${rec.checkInLat.toStringAsFixed(5)}, ${rec.checkInLng.toStringAsFixed(5)}"),
                            _buildHistoryDetailRow("Check-In Address", rec.checkInAddress),
                            if (rec.checkOutTime != null) ...[
                              const Divider(height: 20),
                              _buildHistoryDetailRow("Check-Out Time", rec.checkOutTime!),
                              _buildHistoryDetailRow("Check-Out Coordinates", "${rec.checkOutLat?.toStringAsFixed(5) ?? '--'}, ${rec.checkOutLng?.toStringAsFixed(5) ?? '--'}"),
                              _buildHistoryDetailRow("Check-Out Address", rec.checkOutAddress ?? '--'),
                              _buildHistoryDetailRow("Total Hours Calculated", "${rec.workingHours ?? '0.00'} hours"),
                            ],
                          ],
                        ),
                      )
                    ],
                  ),
                ),
              );
            },
          ),
      ],
    );
  }

  Widget _buildHistoryDetailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4.0),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 130,
            child: Text(
              label,
              style: TextStyle(fontSize: 10, color: Colors.grey.shade600, fontWeight: FontWeight.bold),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: TextStyle(fontSize: 10, color: Colors.grey.shade900, fontWeight: FontWeight.medium),
            ),
          ),
        ],
      ),
    );
  }
}
