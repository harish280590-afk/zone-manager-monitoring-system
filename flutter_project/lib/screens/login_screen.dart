import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/firebase_service.dart';
import 'dashboard_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _empIdController = TextEditingController();
  final _passwordController = TextEditingController();
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  
  bool _isSignUp = false;
  bool _rememberMe = true;
  String _selectedRole = "Zone Manager"; // 'Admin' | 'Zone Manager'
  String? _errorMessage;

  @override
  void dispose() {
    _empIdController.dispose();
    _passwordController.dispose();
    _nameController.dispose();
    _emailController.dispose();
    super.dispose();
  }

  Future<void> _handleSubmit() async {
    final service = Provider.of<FirebaseService>(context, listen: false);
    setState(() {
      _errorMessage = null;
    });

    final empId = _empIdController.text.trim();
    final password = _passwordController.text;

    if (empId.isEmpty) {
      setState(() {
        _errorMessage = "Employee ID is required.";
      });
      return;
    }

    if (password.isEmpty) {
      setState(() {
        _errorMessage = "Password is required.";
      });
      return;
    }

    try {
      if (_isSignUp) {
        final name = _nameController.text.trim();
        final email = _emailController.text.trim();

        if (name.isEmpty) {
          setState(() {
            _errorMessage = "Full Name is required for registration.";
          });
          return;
        }

        if (email.isEmpty || !email.contains('@')) {
          setState(() {
            _errorMessage = "Please enter a valid email address.";
          });
          return;
        }

        await service.signUpWithEmpId(
          empId: empId,
          password: password,
          name: name,
          role: _selectedRole,
          email: email,
          rememberMe: _rememberMe,
        );
      } else {
        await service.signInWithEmpId(
          empId: empId,
          password: password,
          rememberMe: _rememberMe,
        );
      }

      if (mounted) {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (context) => const DashboardScreen()),
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

    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            colors: [Color(0xFFe65100), Color(0xFFff8f00)],
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
          ),
        ),
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24.0),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Card(
                  elevation: 10,
                  shadowColor: Colors.black45,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 32.0),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const Icon(
                          Icons.security,
                          size: 56,
                          color: Color(0xFFe65100),
                        ),
                        const SizedBox(height: 12),
                        const Text(
                          "ZMMS SECURE PORTAL",
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.black,
                            letterSpacing: 1.2,
                            color: Color(0xFFe65100),
                          ),
                        ),
                        const Text(
                          "Zone Manager Monitoring System",
                          textAlign: TextAlign.center,
                          style: TextStyle(fontSize: 11, color: Colors.grey, fontWeight: FontWeight.bold),
                        ),
                        const SizedBox(height: 20),
                        
                        // Error message panel
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
                                Icon(Icons.error_outline, color: Colors.red.shade700, size: 20),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Text(
                                    _errorMessage!,
                                    style: TextStyle(color: Colors.red.shade900, fontSize: 11, fontWeight: FontWeight.medium),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 16),
                        ],

                        // Full Name input (Sign Up Only)
                        if (_isSignUp) ...[
                          TextField(
                            controller: _nameController,
                            decoration: const InputDecoration(
                              labelText: "Full Name",
                              prefixIcon: Icon(Icons.person_outline),
                              border: OutlineInputBorder(),
                              labelStyle: TextStyle(fontSize: 12),
                            ),
                          ),
                          const SizedBox(height: 12),
                        ],

                        // Employee ID Input
                        TextField(
                          controller: _empIdController,
                          decoration: const InputDecoration(
                            labelText: "Employee ID (e.g. EMP-2024-089)",
                            prefixIcon: Icon(Icons.badge_outlined),
                            border: OutlineInputBorder(),
                            labelStyle: TextStyle(fontSize: 12),
                          ),
                        ),
                        const SizedBox(height: 12),

                        // Email Address Input (Sign Up Only)
                        if (_isSignUp) ...[
                          TextField(
                            controller: _emailController,
                            keyboardType: TextInputType.emailAddress,
                            decoration: const InputDecoration(
                              labelText: "Official Email Address",
                              prefixIcon: Icon(Icons.email_outlined),
                              border: OutlineInputBorder(),
                              labelStyle: TextStyle(fontSize: 12),
                            ),
                          ),
                          const SizedBox(height: 12),
                          
                          // Role Picker Dropdown (Sign Up Only)
                          DropdownButtonFormField<String>(
                            value: _selectedRole,
                            decoration: const InputDecoration(
                              labelText: "Assigned Role",
                              prefixIcon: Icon(Icons.assignment_ind_outlined),
                              border: OutlineInputBorder(),
                              labelStyle: TextStyle(fontSize: 12),
                            ),
                            items: const [
                              DropdownMenuItem(value: "Zone Manager", child: Text("Zone Manager")),
                              DropdownMenuItem(value: "Admin", child: Text("Admin")),
                            ],
                            onChanged: (val) {
                              if (val != null) {
                                setState(() {
                                  _selectedRole = val;
                                });
                              }
                            },
                          ),
                          const SizedBox(height: 12),
                        ],

                        // Password Input
                        TextField(
                          controller: _passwordController,
                          obscureText: true,
                          decoration: const InputDecoration(
                            labelText: "Access Password",
                            prefixIcon: Icon(Icons.lock_outline),
                            border: OutlineInputBorder(),
                            labelStyle: TextStyle(fontSize: 12),
                          ),
                        ),
                        const SizedBox(height: 12),

                        // "Remember Login" checkbox option
                        Row(
                          children: [
                            SizedBox(
                              width: 24,
                              height: 24,
                              child: Checkbox(
                                value: _rememberMe,
                                activeColor: const Color(0xFFe65100),
                                onChanged: (value) {
                                  setState(() {
                                    _rememberMe = value ?? true;
                                  });
                                },
                              ),
                            ),
                            const SizedBox(width: 8),
                            const Text(
                              "Remember Login session",
                              style: TextStyle(fontSize: 12, color: Colors.black87, fontWeight: FontWeight.bold),
                            ),
                          ],
                        ),
                        const SizedBox(height: 16),

                        // Form submit trigger
                        ElevatedButton(
                          onPressed: service.isLoading ? null : _handleSubmit,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFFe65100),
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                            elevation: 2,
                          ),
                          child: service.isLoading
                              ? const SizedBox(
                                  width: 20,
                                  height: 20,
                                  child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                                )
                              : Text(
                                  _isSignUp ? "REGISTER NEW ACCOUNT" : "AUTHENTICATE",
                                  style: const TextStyle(fontWeight: FontWeight.bold, letterSpacing: 0.5),
                                ),
                        ),
                        const SizedBox(height: 10),

                        // Toggle Signup / Signin Mode
                        TextButton(
                          onPressed: () {
                            setState(() {
                              _isSignUp = !_isSignUp;
                              _errorMessage = null;
                            });
                          },
                          child: Text(
                            _isSignUp
                                ? "Already registered? Authenticate here"
                                : "No account? Register standard Employee credentials",
                            style: const TextStyle(color: Color(0xFFe65100), fontSize: 11, fontWeight: FontWeight.bold),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                
                // Quick Reference Cheat-sheet for Easy Demonstrations
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.white24),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Row(
                        children: [
                          Icon(Icons.info_outline, color: Colors.white, size: 16),
                          SizedBox(width: 6),
                          Text(
                            "DEVELOPER REFERENCE CHEAT-SHEET",
                            style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.black, letterSpacing: 0.5),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      _buildCheatLine("Admin Access", "EMP-ADMIN-001", "Password123"),
                      const SizedBox(height: 4),
                      _buildCheatLine("Supervisor 1", "EMP-2024-089", "Password123"),
                      const SizedBox(height: 4),
                      _buildCheatLine("Supervisor 2", "EMP-2024-112", "Password123"),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildCheatLine(String label, String empId, String pwd) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.between,
      children: [
        Text(label, style: const TextStyle(color: Colors.white70, fontSize: 10, fontWeight: FontWeight.bold)),
        Text("Emp ID: $empId  |  Pwd: $pwd", style: const TextStyle(color: Colors.white, fontSize: 9, fontFamily: 'monospace')),
      ],
    );
  }
}
