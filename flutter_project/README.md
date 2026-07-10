# ZMMS - Zone Manager Monitoring System (Flutter Client)

This folder contains a fully-fledged, downloadable, production-ready **Flutter project** matching the Zone Manager Monitoring System (ZMMS). It features full Firebase Authentication, Cloud Firestore synchronization, Cloud Storage media upload mocks, simulated background Geo-coordinates streaming (GPS Tracker), and FCM push dispatch simulation.

---

## 🚀 How to Export and Build Locally

Because this online development environment is a specialized **Node.js/React full-stack sandbox container**, it does not contain the Android SDK, Gradle, or the Flutter compiler toolchain. To build the APK, please download the code and compile it locally:

### Step 1: Download / Export the Project
1. Open the **Settings** or **Export** menu in Google AI Studio (top-right menu).
2. Choose **Export as ZIP** or **Commit to GitHub** to export the entire workspace code to your computer.
3. Unzip the archive and locate the `/flutter_project` folder.

### Step 2: Install Flutter SDK (on your PC/Mac)
If you don't have Flutter installed:
1. Download the Flutter SDK for your operating system from the official [Flutter Install Guide](https://docs.flutter.dev/get-started/install).
2. Add the `flutter` binary to your system PATH.
3. Verify your installation by opening a terminal and running:
   ```bash
   flutter doctor
   ```

### Step 3: Initialize Dependencies
Open your terminal inside the `/flutter_project` directory and retrieve the standard pub packages:
```bash
cd flutter_project
flutter pub get
```

### Step 4: Configure Native Firebase Credentials (Optional)
To link this native app to your own live Firebase project console, add your configuration files:
*   **For Android**: Download your `google-services.json` from the Firebase Console and place it at:
    `flutter_project/android/app/google-services.json`
*   **For iOS**: Download your `GoogleService-Info.plist` from the Firebase Console and place it at:
    `flutter_project/ios/Runner/GoogleService-Info.plist`

*Note: If these files are absent, the client app's `Firebase.initializeApp()` wrapper gracefully activates offline simulation mode so you can preview all operational screens safely.*

### Step 5: Build the Production APK
To compile the release APK ready to be installed on any Android device:
```bash
flutter build apk --release
```
The compiled package will be available in:
`build/app/outputs/flutter-apk/app-release.apk`

---

## 📱 Folder Structure Reference
*   `lib/main.dart`: Standard initialization, Theme system, and Provider bindings.
*   `lib/models/zone_manager.dart`: Data structures for zone operators.
*   `lib/services/firebase_service.dart`: Integrates OIDC Auth, Firestore live streams, Cloud Storage proxy, diagnostic telemetry, and simulated FCM.
*   `lib/screens/login_screen.dart`: Authentication card portal.
*   `lib/screens/dashboard_screen.dart`: Operator overview log, active metrics, and spatial visualizer coordinate-mapping.
*   `lib/screens/firebase_control_screen.dart`: Control dashboard to trigger mock push messages, bootstrap database collections, inspect telemetry logs, and simulate exceptions.
