import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:firebase_core/firebase_core.dart';
import 'services/firebase_service.dart';
import 'screens/login_screen.dart';
import 'screens/dashboard_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  try {
    await Firebase.initializeApp();
  } catch (e) {
    // Graceful fallback if native configurations are pending matching credentials
    debugPrint("Firebase initialization bypassed for client simulation: $e");
  }

  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => FirebaseService()),
      ],
      child: const ZoneManagerApp(),
    ),
  );
}

class ZoneManagerApp extends StatelessWidget {
  const ZoneManagerApp({super.key});

  @override
  Widget build(BuildContext context) {
    final service = Provider.of<FirebaseService>(context);

    return MaterialApp(
      title: 'ZMMS - Zone Manager Monitoring System',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        primarySwatch: Colors.orange,
        useMaterial3: true,
        fontFamily: 'Inter',
        cardTheme: CardTheme(
          elevation: 2,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
        inputDecorationTheme: InputDecorationTheme(
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
          filled: true,
          fillColor: Colors.grey.shade50,
        ),
      ),
      home: service.currentSessionUser == null ? const LoginScreen() : const DashboardScreen(),
    );
  }
}
